const { declare } = require('@babel/helper-plugin-utils');
const importModule = require('@babel/helper-module-imports');

const autoTrackPlugin = declare((api, options, dirname) => {
    api.assertVersion(7);

    return {
        visitor: {
            // Program visitor 在整个 AST 开始遍历前执行，用于初始化工作
            Program: {
                enter: (path, state) => {
                    // 第一步：查找是否已导入 tracker 模块
                    // 使用 path.traverse 遍历当前 Program 节点下的所有子节点
                    path.traverse({
                        ImportDeclaration(curPath) {
                            const requiredModuleName = curPath.get('source').node.value;
                            if (requiredModuleName === options.trackerPath) {
                                // 找到匹配的导入，获取导入标识符名称
                                // 支持：import tracker from 'xxx'、import { track } from 'xxx'、import * as tracker from 'xxx'
                                const specifierName = curPath.get('specifiers.0');
                                if (specifierName.isImportDefaultSpecifier()) {
                                    state.trackImportId = specifierName.toString();
                                } else if (
                                    specifierName.isImportNamespaceSpecifier() ||
                                    specifierName.isImportSpecifier()
                                ) {
                                    state.trackImportId = specifierName.get('local').toString();
                                }
                                // 使用 template 创建 tracker() 调用语句的 AST
                                // 保存到 state 供后续 visitor 使用
                                state.trackerAST = api.template.statement(
                                    `${state.trackImportId}()`
                                )();
                                curPath.stop(); // 找到后停止遍历
                            }
                        },
                    });

                    // 第二步：如果没找到 tracker 导入，自动添加默认导入
                    // 使用 @babel/helper-module-imports 的 addDefault 方法
                    // nameHint 用于生成唯一的标识符名称
                    if (!state.trackImportId) {
                        state.trackImportId = importModule.addDefault(
                            path,
                            options.trackerPath || 'tracker',
                            {
                                nameHint: path.scope.generateUid('tracker'),
                            }
                        ).name;
                        state.trackerAST = api.template.statement(`${state.trackImportId}()`)();
                    }
                },
            },
            // 第三步：为所有函数类型插入 tracker 调用
            // 使用组合 visitor 匹配多种节点类型
            'ClassMethod|ArrowFunctionExpression|FunctionDeclaration|FunctionExpression'(
                path,
                state
            ) {
                const bodyPath = path.get('body');
                if (bodyPath.isBlockStatement()) {
                    // 函数已有块级 body，直接在开头插入 tracker 调用
                    // 必须使用 cloneNode 克隆节点，否则同一 AST 节点会被多次使用导致报错
                    bodyPath.node.body.unshift(api.types.cloneNode(state.trackerAST));
                } else {
                    // 箭头函数简写体：() => expression
                    // 需要转换为块级 body：() => { tracker(); return expression; }
                    const ast = api.template.statement(
                        `{ ${state.trackImportId}(); return PREV_BODY; }`
                    )({
                        PREV_BODY: bodyPath.node,
                    });
                    bodyPath.replaceWith(ast);
                }
            },
        },
    };
});

module.exports = autoTrackPlugin;
