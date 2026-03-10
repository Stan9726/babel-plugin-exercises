module.exports = class DependencyNode {
    constructor(path = '', imports = {}, exports = []) {
        // 当前模块的绝对路径
        this.path = path;
        // imports: { 依赖模块路径 -> import 规格数组 }
        // 例：
        // {
        //   '/abs/a.js': [ { type: 'default', localName: 'foo' } ]
        // }
        this.imports = imports;
        // exports: 当前模块导出信息数组
        // 例：
        // [
        //   { type: 'named', localName: 'a', exportedName: 'a' },
        //   { type: 'default', exported: 'default' }
        // ]
        this.exports = exports;
        // subModules: { 依赖模块路径 -> DependencyNode 子树 }
        this.subModules = {};
    }
};
