const { declare } = require('@babel/helper-plugin-utils');

const manglePlugin = declare((api) => {
    api.assertVersion(7);

    return {
        visitor: {
            /**
             * 处理函数声明名称混淆
             *
             * 为什么需要单独处理？
             * 函数声明（function add() {}）的 binding.kind 是 'hoisted'，它的 path.scope 指向函数自己的作用域
             * 而不是父作用域。因此在 Scopable.exit 中会被 scope !== path.scope 的条件过滤掉
             * 所以需要单独在 FunctionDeclaration 节点的 exit 阶段处理
             */
            FunctionDeclaration: {
                exit(path) {
                    // 获取函数名
                    const funcName = path.node.id.name;
                    const binding = path.scope.getBinding(funcName);

                    // 只处理当前作用域定义的函数（不处理外部引用）
                    if (binding && binding.path === path) {
                        // 在父作用域中重命名函数名
                        // path.scope.parent 是函数声明所在的作用域
                        const newName = path.scope.parent.generateUid();
                        path.scope.parent.rename(funcName, newName);
                    }
                },
            },

            /**
             * 处理变量和参数混淆
             *
             * Scopable: 涵盖所有类型的作用域节点（Function、BlockStatement、Program 等）
             * exit 阶段：在离开作用域时处理，此时该作用域的所有子节点都已遍历完成
             */
            Scopable: {
                exit(path) {
                    Object.entries(path.scope.bindings).forEach(([name, binding]) => {
                        /**
                         * 跳过条件：
                         * 1. binding.path.scope !== path.scope
                         *    该 binding 是外层作用域的变量（在当前作用域只是被引用）
                         *    例如：在函数内引用了全局变量，该变量属于 Program 作用域
                         * 2. binding.kind === 'hoisted'
                         *    函数声明已在 FunctionDeclaration.exit 中单独处理
                         */
                        if (binding.path.scope !== path.scope || binding.kind === 'hoisted') return;

                        // 生成唯一的混淆名称（_temp, _temp2, ...）
                        const newName = path.scope.generateUid();

                        // path.scope.rename(name, newName)
                        // 在当前作用域中重命名变量，所有引用也会被自动更新
                        path.scope.rename(name, newName);
                    });
                },
            },
        },
    };
});

module.exports = manglePlugin;
