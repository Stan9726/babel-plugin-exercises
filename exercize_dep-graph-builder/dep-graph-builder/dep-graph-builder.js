const parser = require('@babel/parser');
const traverse = require('@babel/traverse').default;
const fs = require('fs');
const DependencyNode = require('./dep-node');
const { resolveBabelSyntaxPlugins, resolveModulePath } = require('./path-resolver');

/**
 * 目标：解析模块并生成「依赖图」
 * 流程：读取文件 -> 解析 AST -> 遍历 import / export -> 记录依赖关系
 * 说明：真实世界模块依赖是图（可能有重复引用/循环），这里用 visitedModules 防止死循环，
 *      同时把所有模块放进 allModules 作为图的索引
 */
// import 的几种形式
const IMPORT_TYPE = {
    deconstruct: 'deconstruct',
    default: 'default',
    namespace: 'namespace',
    sideEffect: 'side-effect',
};

// export 的几种形式
const EXPORT_TYPE = {
    all: 'all',
    named: 'named',
    default: 'default',
};

const linkSubModule = (
    curModulePath,
    rawImportPath,
    dependencyGraphNode,
    allModules,
    visitedModules
) => {
    const subModulePath = resolveModulePath(curModulePath, rawImportPath);
    if (!subModulePath) {
        return '';
    }

    if (!visitedModules.has(subModulePath)) {
        visitedModules.add(subModulePath);
        const subModuleNode = new DependencyNode();
        traverseModule(subModulePath, subModuleNode, allModules, visitedModules);
        dependencyGraphNode.subModules[subModulePath] = subModuleNode;
    } else if (!dependencyGraphNode.subModules[subModulePath]) {
        dependencyGraphNode.subModules[subModulePath] = allModules[subModulePath];
    }

    return subModulePath;
};

/**
 * 递归遍历模块，构建依赖图
 * @param {string} curModulePath 当前模块文件路径
 * @param {DependencyNode} 模块依赖图节点
 * @param {object} allModules 全量索引表，便于「按路径查找模块节点」
 * @param {Set} visitedModules 记录已访问模块，避免重复递归与循环依赖死循环
 */
const traverseModule = (curModulePath, dependencyGraphNode, allModules, visitedModules) => {
    // 记录已访问，防止循环依赖无限递归
    visitedModules.add(curModulePath);
    const moduleFileContent = fs.readFileSync(curModulePath, 'utf-8'); // 源码字符串
    // 把路径写进节点，便于最终输出时定位
    dependencyGraphNode.path = curModulePath;

    // 解析成 AST（File 节点 -> program.body 是语句数组）
    const ast = parser.parse(moduleFileContent, {
        sourceType: 'unambiguous',
        plugins: resolveBabelSyntaxPlugins(curModulePath),
    });

    // 遍历 AST，收集 import / export 信息
    traverse(ast, {
        ImportDeclaration(path) {
            // import './a' 或 import { x } from './a'
            // source.value 是字符串字面量，表示模块路径
            const importSource = path.get('source.value').node; // import 的字符串路径
            const subModulePath = linkSubModule(
                curModulePath,
                importSource,
                dependencyGraphNode,
                allModules,
                visitedModules
            );
            if (!subModulePath) {
                return;
            }

            const specifiers = path.get('specifiers'); // import 的导入项列表
            if (specifiers.length === 0) {
                // 仅引入模块副作用：import './xxx'
                dependencyGraphNode.imports[subModulePath] = [{ type: IMPORT_TYPE.sideEffect }];
            } else {
                // 记录 import 的具体形式与本地变量名
                // specifier 类型决定 import 的语法形式：
                dependencyGraphNode.imports[subModulePath] = specifiers.map((specifier) => {
                    // - ImportSpecifier: import { a as b } from './x'
                    if (specifier.isImportSpecifier()) {
                        return {
                            type: IMPORT_TYPE.deconstruct,
                            importedName: specifier.get('imported.name').node,
                            localName: specifier.get('local.name').node,
                        };
                    }
                    // - ImportDefaultSpecifier: import foo from './x'
                    if (specifier.isImportDefaultSpecifier()) {
                        return {
                            type: IMPORT_TYPE.default,
                            localName: specifier.get('local.name').node,
                        };
                    }
                    // - ImportNamespaceSpecifier: import * as foo from './x'
                    if (specifier.isImportNamespaceSpecifier()) {
                        return {
                            type: IMPORT_TYPE.namespace,
                            localName: specifier.get('local.name').node,
                        };
                    }
                });
            }
        },
        ExportNamedDeclaration(path) {
            if (path.node.source?.value) {
                linkSubModule(
                    curModulePath,
                    path.node.source.value,
                    dependencyGraphNode,
                    allModules,
                    visitedModules
                );
            }

            // export {...} 的导出项列表
            const specifiers = path.get('specifiers');
            if (specifiers.length > 0) {
                // export { a as b } from './x'
                // 这里记录 exportedName / localName，便于后续展示“导出名 -> 本地名”
                specifiers.forEach((specifier) => {
                    dependencyGraphNode.exports.push({
                        type: EXPORT_TYPE.named,
                        localName: specifier.get('local.name').node,
                        exportedName: specifier.get('exported.name').node,
                        source: path.node.source?.value || '',
                    });
                });
                return;
            }

            const declaration = path.get('declaration'); // export 后面的声明节点
            // export const a = 1;
            if (declaration.isVariableDeclaration()) {
                // 变量声明可能包含多个声明项
                declaration.get('declarations').forEach((decl) => {
                    const id = decl.get('id');
                    if (id.isIdentifier()) {
                        dependencyGraphNode.exports.push({
                            type: EXPORT_TYPE.named,
                            localName: id.node.name,
                            exportedName: id.node.name,
                            source: '',
                        });
                    }
                });
            }
            // export function foo() {}
            else if (declaration.isFunctionDeclaration()) {
                dependencyGraphNode.exports.push({
                    type: EXPORT_TYPE.named,
                    localName: declaration.node.id.name,
                    exportedName: declaration.node.id.name,
                    source: '',
                });
            }
        },
        ExportDefaultDeclaration(path) {
            // export default xxx;
            // 这里仅记录一个可读的名称，便于输出观察
            const declaration = path.get('declaration'); // default 后面的表达式/函数/标识符
            let exportName = 'default';
            if (declaration.isIdentifier()) {
                exportName = declaration.node.name;
            } else if (declaration.isFunctionDeclaration() && declaration.node.id) {
                exportName = declaration.node.id.name;
            }

            dependencyGraphNode.exports.push({
                type: EXPORT_TYPE.default,
                exported: exportName,
            });
        },
        ExportAllDeclaration(path) {
            linkSubModule(
                curModulePath,
                path.node.source.value,
                dependencyGraphNode,
                allModules,
                visitedModules
            );
            // export * from './x'
            dependencyGraphNode.exports.push({
                type: EXPORT_TYPE.all,
                exported: '*',
                source: path.get('source.value').node,
            });
        },
    });

    // 记录到全量索引表，便于按路径查找
    allModules[curModulePath] = dependencyGraphNode;
};

module.exports = (curModulePath) => {
    const visitedModules = new Set();
    const dependencyGraph = {
        root: new DependencyNode(),
        allModules: {},
    };
    traverseModule(curModulePath, dependencyGraph.root, dependencyGraph.allModules, visitedModules);
    return dependencyGraph;
};
