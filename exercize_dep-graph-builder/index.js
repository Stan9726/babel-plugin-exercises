const buildDependencyGraph = require('./dep-graph-builder/dep-graph-builder');
const path = require('path');

// 模块依赖本质是「图」，输出为「树形视图」仅用于更直观地阅读
// - root/subModules 是树形展开
// - allModules 是依赖图的去重索引表
const dependencyGraph = buildDependencyGraph(path.resolve(__dirname, './demo-project/index.js'));

// 输出简化摘要（更易读）
const rootPath = dependencyGraph.root.path;
const rootDir = path.dirname(rootPath);
const toRel = (p) => path.relative(rootDir, p) || '.';

const formatImports = (imports) => {
    return Object.entries(imports).map(([dep, specs]) => {
        const brief = specs.map((s) => {
            if (s.type === 'default') return `default:${s.localName}`;
            if (s.type === 'namespace') return `* as ${s.localName}`;
            if (s.type === 'deconstruct') return `{${s.importedName} as ${s.localName}}`;
            return 'side-effect';
        });
        return `${toRel(dep)} => ${brief.join(', ')}`;
    });
};

const formatExports = (exports) => {
    return exports.map((e) => {
        if (e.type === 'named') return `named:${e.exportedName}`;
        if (e.type === 'default') return `default:${e.exported || 'default'}`;
        return `all:${e.source}`;
    });
};

const printTree = (node, depth = 0) => {
    const indent = '  '.repeat(depth);
    const relPath = toRel(node.path);
    console.log(`${indent}- ${relPath}`);
    const imports = formatImports(node.imports);
    const exports = formatExports(node.exports);
    if (imports.length) {
        console.log(`${indent}  imports: ${imports.join(' | ')}`);
    }
    if (exports.length) {
        console.log(`${indent}  exports: ${exports.join(' | ')}`);
    }
    Object.values(node.subModules).forEach((child) => printTree(child, depth + 1));
};

console.log('\n=== Dependency Summary ===');
printTree(dependencyGraph.root);
