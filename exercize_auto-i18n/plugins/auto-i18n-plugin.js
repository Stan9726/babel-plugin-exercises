const { declare } = require('@babel/helper-plugin-utils');
const fs = require('fs');
const path = require('path');

let intlKeyIndex = 0;
const nextIntlKey = () => `auto_intl_key_${intlKeyIndex++}`;

const resetIntlKeyIndex = () => {
    intlKeyIndex = 0;
};

const autoI18nPlugin = declare((api, options, dirname) => {
    api.assertVersion(7);

    // 测试模式：重置计数器
    if (options.resetIndex) {
        resetIntlKeyIndex();
    }

    // 校验必需参数
    if (!options.outputDir) {
        throw new Error('auto-i18n-plugin: outputDir option is required');
    }

    // intl 模块路径，默认使用 'intl'
    const moduleSource = options.moduleSource || 'intl';

    /**
     * 根据上下文将字符串替换为 intl.t(key) 调用
     *
     * @param {NodePath} path - 当前 AST 节点路径
     * @param {string} key - 国际化 key
     * @param {string} intlUid - intl 模块的标识符名称
     */
    const getReplaceExpression = (path, key, intlUid) => {
        // 提取模板字符串中的变量表达式，转换为代码字符串
        // 例如：`hello ${name}` -> 提取出 "name"
        // 使用 path.get('expressions').map(p => p.toString()) 可获取表达式对应的源代码
        const expressionParams = path.isTemplateLiteral()
            ? path.get('expressions').map((item) => item.toString())
            : null;

        // 使用 api.template.ast 从字符串构建 AST 节点
        // 这是创建 AST 的推荐方式，比手动构建节点更简洁
        const callExpr = api.template.ast(
            `${intlUid}.t('${key}'${expressionParams ? ', ' + expressionParams.join(',') : ''})`
        ).expression;

        // JSX 属性语法有两种形式：
        // - title="text" (JSXAttribute + JSXText/StringLiteral)
        // - title={"text"} (JSXAttribute + JSXExpressionContainer)
        // 前者需要包装，后者不需要
        if (
            path.findParent((p) => p.isJSXAttribute()) &&
            !path.findParent((p) => p.isJSXExpressionContainer())
        ) {
            return api.types.jsxExpressionContainer(callExpr);
        }

        // JSX 文本节点（如 <div>hello</div> 中的 "hello"）必须包装在 JSXExpressionContainer 中
        if (path.isJSXText()) {
            return api.types.jsxExpressionContainer(callExpr);
        }

        return callExpr;
    };

    /**
     * 保存提取的文本到文件 metadata 中
     *
     * Babel 插件数据传递方式：
     * - state: 仅在当前 visitor 层级内传递
     * - file.set/get: 可在 pre/post 阶段和不同 visitor 之间共享数据
     *
     * 这里使用 file metadata 是因为：
     * 1. Program visitor 标记需要跳过的字符串
     * 2. StringLiteral/TemplateLiteral/JSXText visitor 处理实际替换
     * 3. post 阶段生成语言文件
     * 这三个阶段的 visitor 并不都在同一个 state 对象中传递
     */
    const save = (file, key, value) => {
        const text = file.get('text');
        text.push({ key, value });
        file.set('text', text);
    };

    return {
        /**
         * 初始化 file metadata，用于存储提取的文本
         */
        pre(file) {
            file.set('text', []);
        },

        visitor: {
            /**
             * 执行初始化工作：
             * 1. 查找并处理 intl 模块导入（自动注入 if needed）
             * 2. 标记需要跳过的字符串（i18n-disable 注释、import 声明）
             */
            Program: {
                enter(path, state) {
                    // 第一步：查找是否已导入 intl 模块
                    let isImported = false;

                    // 使用 path.traverse() 在当前节点下遍历
                    // 查找 ImportDeclaration 节点
                    path.traverse({
                        ImportDeclaration(curPath) {
                            const source = curPath.node.source.value;
                            if (source === moduleSource) {
                                // 获取导入的标识符名称
                                // import intl from 'intl'     -> ImportDefaultSpecifier
                                // import * as intl from 'intl' -> ImportNamespaceSpecifier
                                // import { t } from 'intl'    -> ImportSpecifier
                                const specifier = curPath.get('specifiers.0');
                                if (specifier.isImportDefaultSpecifier()) {
                                    state.intlUid = specifier.toString();
                                } else if (
                                    specifier.isImportNamespaceSpecifier() ||
                                    specifier.isImportSpecifier()
                                ) {
                                    state.intlUid = specifier.get('local').toString();
                                }

                                isImported = true;
                                // 找到后停止遍历，提高性能
                                curPath.stop();
                            }
                        },
                    });

                    // 如果未导入，自动添加 import 语句
                    if (!isImported) {
                        // scope.generateUid 生成唯一的标识符，避免命名冲突
                        const uid = path.scope.generateUid('intl');
                        const importAst = api.template.ast(`import ${uid} from '${moduleSource}';`);
                        // unshift 添加到数组开头
                        path.node.body.unshift(importAst);
                        state.intlUid = uid;
                    }

                    // 第二步：标记需要跳过的字符串
                    // 使用 leadingComments 检测 i18n-disable 注释
                    // AST 节点可以通过 leadingComments/trailingComments 访问注释
                    path.traverse({
                        'StringLiteral|TemplateLiteral|JSXText'(path) {
                            // 检查 i18n-disable 注释
                            if (path.node.leadingComments) {
                                path.node.leadingComments = path.node.leadingComments.filter(
                                    (comment) => {
                                        if (comment.value.trim() === 'i18n-disable') {
                                            // 标记该节点跳过转换
                                            path.node.skipTransform = true;
                                            return false; // 从数组中移除该注释
                                        }
                                        return true;
                                    }
                                );
                            }

                            // 跳过 import 语句中的字符串（如 import 'intl'）
                            if (path.findParent((p) => p.isImportDeclaration())) {
                                path.node.skipTransform = true;
                            }
                        },
                    });
                },
            },

            /**
             * 处理普通字符串字面量
             *
             * 示例：
             * - "hello" -> intl.t('auto_intl_key_0')
             * - title="app" 不转换（因为是 JSX 属性值）
             * - title={"app"} -> intl.t('auto_intl_key_0')
             */
            StringLiteral(path, state) {
                // 检查是否标记为跳过（i18n-disable 注释）
                if (path.node.skipTransform) {
                    return;
                }

                // JSX 属性值的两种形式：
                // - title="app" -> JSXAttribute 的 value 是 StringLiteral，不转换
                // - title={"app"} -> JSXAttribute 的 value 是 JSXExpressionContainer，转换
                if (
                    path.findParent((p) => p.isJSXAttribute()) &&
                    !path.findParent((p) => p.isJSXExpressionContainer())
                ) {
                    return;
                }

                // 生成唯一的 key 并保存到 metadata
                const key = nextIntlKey();
                save(state.file, key, path.node.value);

                // 替换为 intl.t() 调用
                const replaceExpr = getReplaceExpression(path, key, state.intlUid);
                path.replaceWith(replaceExpr);

                // skip() 阻止子节点遍历（字符串没有子节点，但这是好习惯）
                path.skip();
            },

            /**
             * 处理模板字符串
             *
             * 示例：
             * - `hello ${name}` -> intl.t('key', name)
             * - `desc` -> intl.t('key')（空模板字符串当作普通字符串处理）
             *
             * 语言文件格式：使用 {0}, {1} 作为占位符
             * - `aaa ${a} bbb ${b}` -> "aaa {0} bbb {1}"
             */
            TemplateLiteral(path, state) {
                // 检查跳过标记
                if (path.node.skipTransform) {
                    return;
                }

                // 获取模板字符串中的表达式数组（${xxx} 部分）
                const expressions = path.node.expressions;

                let value;

                if (expressions.length === 0) {
                    // 空模板字符串：提取 quasis 中的原始文本
                    // 例如：`desc` -> "desc"
                    value = path.get('quasis.0').node.value.raw;
                } else {
                    // 有变量的模板字符串：提取静态文本并插入序号占位符
                    // 例如：`aaa ${a} bbb ${b}` -> "aaa {0} bbb {1}"
                    value = path
                        .get('quasis')
                        .map((elem, index) => {
                            const text = elem.node.value.raw;
                            return index < expressions.length ? text + '{' + index + '}' : text;
                        })
                        .join('');
                }

                const key = nextIntlKey();
                save(state.file, key, value);

                const replaceExpr = getReplaceExpression(path, key, state.intlUid);
                path.replaceWith(replaceExpr);
                path.skip();
            },

            /**
             * 处理 JSX 文本节点
             *
             * JSX 中的文本分为两种：
             * - JSXText: <div>hello</div> 中的 "hello"（纯文本）
             * - JSXExpressionContainer: <div>{expr}</div> 中的 {expr}
             *
             * 关键点：
             * - JSXText 需要包装在 JSXExpressionContainer 中
             * - 跳过 JSXExpressionContainer 内的文本（那是 ${变量} 的 $ 和 } 字符）
             */
            JSXText(path, state) {
                if (path.node.skipTransform) {
                    return;
                }

                // 跳过 {xxx} 内部的文本（$ 和 } 字符属于 JSXText）
                if (path.findParent((p) => p.isJSXExpressionContainer())) {
                    return;
                }

                const value = path.node.value.trim();
                if (value) {
                    const key = nextIntlKey();
                    save(state.file, key, value);

                    const replaceExpr = getReplaceExpression(path, key, state.intlUid);
                    path.replaceWith(replaceExpr);
                    path.skip();
                }
            },
        },

        /**
         * 生成语言文件：从 file metadata 获取所有提取的文本，写入到指定目录
         */
        post(file) {
            // 从 file metadata 获取所有提取的文本
            const text = file.get('text');
            const intlData = text.reduce((acc, { key, value }) => {
                acc[key] = value;
                return acc;
            }, {});

            // 生成语言文件内容
            const content = `export default ${JSON.stringify(intlData, null, 4)};`;

            // 输出到指定目录
            fs.mkdirSync(options.outputDir, { recursive: true });
            fs.writeFileSync(path.join(options.outputDir, 'zh_CN.js'), content, 'utf-8');
            fs.writeFileSync(path.join(options.outputDir, 'en_US.js'), content, 'utf-8');
        },
    };
});

module.exports = autoI18nPlugin;
