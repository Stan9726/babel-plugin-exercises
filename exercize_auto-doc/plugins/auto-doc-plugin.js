const { declare } = require('@babel/helper-plugin-utils');
const doctrine = require('doctrine');
const renderMd = require('./renderer/markdown');
const fs = require('fs');
const path = require('path');

/**
 * 解析 JSDoc 注释
 * @param {string} comment - JSDoc 注释内容
 * @returns {object} 解析后的注释对象，包含 description 和 tags
 *
 * 使用 doctrine 库解析 JSDoc 格式的注释
 * 例如: /** @param name 名字 *\/ 会被解析为 { tags: [{ name: 'param', description: '名字' }] }
 */
const parseComment = (comment) => {
    if (!comment) return;
    return doctrine.parse(comment, { unwrap: true });
};

/**
 * 将 Babel AST 类型节点转换为可读的类型字符串
 * @param {object} typeAnnotation - Babel AST 类型节点
 * @returns {string} 转换后的类型字符串
 *
 * 支持的类型：
 * - TSStringKeyword -> string
 * - TSNumberKeyword -> number
 * - TSBooleanKeyword -> boolean
 * - TSTypeReference -> 类型引用（如自定义类型）
 * - TSArrayType -> 数组类型（如 string[]）
 * - TSVoidKeyword -> void
 * - TSAnyKeyword -> any
 */
const getTypeFromAnnotation = (typeAnnotation) => {
    if (!typeAnnotation) return;
    switch (typeAnnotation.type) {
        case 'TSStringKeyword':
            return 'string';
        case 'TSNumberKeyword':
            return 'number';
        case 'TSBooleanKeyword':
            return 'boolean';
        case 'TSTypeReference':
            return typeAnnotation.typeName?.name || 'unknown';
        case 'TSArrayType':
            return getTypeFromAnnotation(typeAnnotation.elementType) + '[]';
        case 'TSVoidKeyword':
            return 'void';
        case 'TSAnyKeyword':
            return 'any';
        default:
            return typeAnnotation.typeName?.name;
    }
};

/**
 * 从 Babel Path 获取类型注解
 * @param {object} path - Babel Path 对象
 * @returns {string} 类型字符串
 *
 * 注意：
 * 1. ClassMethod 的返回类型需要特殊处理，因为 getTypeAnnotation() 返回的是 AnyTypeAnnotation
 * 2. 如果 Path 没有 node（如函数没有返回类型），直接返回 undefined
 */
const resolveType = (path) => {
    if (!path?.node) {
        return;
    }
    const typeAnnotation = path.getTypeAnnotation();
    if (!typeAnnotation) {
        return;
    }
    // 嵌套类型注解（如函数参数）需要从 typeAnnotation 属性获取
    if (typeAnnotation.typeAnnotation) {
        return getTypeFromAnnotation(typeAnnotation.typeAnnotation);
    }
    // ClassMethod 特殊处理：类型注解可能是 AnyTypeAnnotation，需要获取 returnType
    if (typeAnnotation.type === 'AnyTypeAnnotation') {
        const returnType = path.get('returnType');
        if (returnType?.node) {
            return getTypeFromAnnotation(returnType.getTypeAnnotation());
        }
    }
    return getTypeFromAnnotation(typeAnnotation);
};

/**
 * 从参数 Path 中提取参数名
 * @param {object} paramPath - 参数的 Babel Path
 * @returns {string} 参数名
 *
 * 处理场景：
 * - 普通标识符: (name) -> name
 * - 默认参数: (name = 'default') -> name
 * - 其他复杂情况返回完整字符串
 */
const getParamName = (paramPath) => {
    if (paramPath.isIdentifier()) {
        return paramPath.node.name;
    }
    if (paramPath.isAssignmentPattern()) {
        return paramPath.get('left').toString();
    }
    return paramPath.toString();
};

const autoDocPlugin = declare((api, options) => {
    api.assertVersion(7);

    // 验证必要选项
    if (!options.outputDir) {
        throw new Error('auto-doc-plugin: options.outputDir is required');
    }

    return {
        /**
         * 初始化：创建一个数组用于存储收集到的文档信息
         */
        pre: (file) => {
            file.set('doc', []);
        },

        visitor: {
            /**
             * 访问函数声明
             * 收集函数名、参数、返回类型和 JSDoc 注释
             */
            FunctionDeclaration: (path, state) => {
                const docs = state.file.get('doc');
                docs.push({
                    type: 'function',
                    name: path.get('id').toString(),
                    params: path.get('params').map((paramPath) => {
                        return {
                            name: getParamName(paramPath),
                            type: resolveType(paramPath),
                        };
                    }),
                    return: resolveType(path.get('returnType')),
                    doc: parseComment(path.node.leadingComments?.[0]?.value),
                });
                state.file.set('doc', docs);
            },

            /**
             * 访问类声明
             * 收集类名、构造函数、属性和方法信息
             *
             * 使用 path.traverse 遍历类内部的节点：
             * - ClassProperty: 类的属性
             * - ClassMethod: 类的方法（包括构造函数）
             */
            ClassDeclaration: (path, state) => {
                const docs = state.file.get('doc');
                const classInfo = {
                    type: 'class',
                    name: path.get('id').toString(),
                    constructors: {}, // 构造函数信息
                    methodsInfo: [], // 方法列表
                    propertiesInfo: [], // 属性列表
                    doc: parseComment(path.node.leadingComments?.[0]?.value),
                };

                // 遍历类内部节点
                path.traverse({
                    // 收集类的属性信息
                    ClassProperty: (path) => {
                        classInfo.propertiesInfo.push({
                            name: path.get('key').toString(),
                            type: resolveType(path),
                            doc: path.node.leadingComments?.map((comment) =>
                                parseComment(comment.value)
                            ),
                        });
                    },

                    // 收集类的方法信息（区分构造函数和普通方法）
                    ClassMethod: (path) => {
                        // 构造函数
                        if (path.node.kind === 'constructor') {
                            classInfo.constructors = {
                                params: path.get('params').map((paramPath) => {
                                    return {
                                        name: getParamName(paramPath),
                                        type: resolveType(paramPath),
                                        doc: parseComment(
                                            paramPath.node.leadingComments?.[0]?.value
                                        ),
                                    };
                                }),
                            };
                        } else {
                            // 普通方法
                            classInfo.methodsInfo.push({
                                name: path.get('key').toString(),
                                params: path.get('params').map((paramPath) => {
                                    return {
                                        name: getParamName(paramPath),
                                        type: resolveType(paramPath),
                                    };
                                }),
                                return: resolveType(path),
                                doc: parseComment(path.node.leadingComments?.[0]?.value),
                            });
                        }
                    },
                });

                docs.push(classInfo);
                state.file.set('doc', docs);
            },
        },

        /**
         * 在遍历完成后执行，将收集的信息渲染为 Markdown 并写入文件
         */
        post: (file) => {
            const docs = file.get('doc');
            const res = renderMd(docs);
            fs.mkdirSync(options.outputDir, { recursive: true });
            fs.writeFileSync(path.join(options.outputDir, 'api-doc.md'), res);
        },
    };
});

module.exports = autoDocPlugin;
