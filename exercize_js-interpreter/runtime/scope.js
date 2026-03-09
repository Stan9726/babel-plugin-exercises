class Scope {
    constructor(parent = null) {
        // parent 形成作用域链：当前找不到变量时向上级作用域查找
        this.parent = parent;
        // declarations 只保存「当前作用域自己声明的变量」
        this.declarations = {};
    }

    set(name, value) {
        // 只在当前作用域写入，不回溯到父作用域
        this.declarations[name] = value;
    }

    get(name) {
        // 先查当前作用域，再递归查父作用域；这就是词法作用域链
        if (Object.prototype.hasOwnProperty.call(this.declarations, name)) {
            return this.declarations[name];
        }
        if (this.parent) {
            return this.parent.get(name);
        }
        return undefined;
    }

    has(name) {
        // has 会沿作用域链查找，适合「是否可访问」的判断
        if (this.hasOwn(name)) {
            return true;
        }
        if (this.parent) {
            return this.parent.has(name);
        }
        return false;
    }

    hasOwn(name) {
        // hasOwn 只检查当前作用域，适合「是否在同一层重复声明」的判断
        return Object.prototype.hasOwnProperty.call(this.declarations, name);
    }
}

module.exports = Scope;
