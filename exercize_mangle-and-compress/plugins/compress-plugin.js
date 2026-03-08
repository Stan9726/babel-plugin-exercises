const { declare } = require('@babel/helper-plugin-utils');
const t = require('@babel/types');

const removeDeclarator = (bindingPath) => {
    const declarationPath = bindingPath.parentPath;

    if (bindingPath.parent.declarations.length === 1) {
        declarationPath.remove();
        return;
    }

    bindingPath.remove();
};

const replaceDeclaratorWithExpression = (bindingPath, expression) => {
    const declarationPath = bindingPath.parentPath;

    if (bindingPath.parent.declarations.length === 1) {
        declarationPath.replaceWith(t.expressionStatement(expression));
        return;
    }

    declarationPath.insertBefore(t.expressionStatement(expression));
    bindingPath.remove();
};

const compressPlugin = declare((api) => {
    api.assertVersion(7);

    return {
        visitor: {
            /**
             * 死代码删除
             *
             * 在 enter 阶段处理，因为需要在遍历子节点之前判断并删除
             *
             * 不可达代码示例：
             * function f() {
             *     return 1;
             *     console.log('unreachable');  // 这行永远不会执行
             * }
             */
            BlockStatement: {
                enter(path) {
                    // 只处理函数体内的 BlockStatement
                    if (!path.parentPath.isFunction()) return;

                    const statements = path.get('body');
                    let purge = false; // 标记是否遇到完成语句

                    for (const stmt of statements) {
                        /**
                         * isCompletionStatement(): 判断是否是完成语句
                         * 包括：return, throw, break, continue
                         * 这些语句后的代码永远不会执行
                         */
                        if (stmt.isCompletionStatement()) {
                            purge = true;
                            continue;
                        }

                        /**
                         * 删除不可达代码
                         *
                         * 例外情况（不可删除）：
                         * 1. FunctionDeclaration: 函数声明会提升，不影响作用域
                         * 2. VariableDeclaration({ kind: 'var' }): var 也会提升
                         *
                         * 为什么不能删除提升的声明？
                         * 因为它们在作用域开始处就已经被声明了
                         */
                        if (
                            purge &&
                            !stmt.isFunctionDeclaration() &&
                            !stmt.isVariableDeclaration({ kind: 'var' })
                        ) {
                            stmt.remove(); // 从 AST 中移除该节点
                        }
                    }
                },
            },

            /**
             * 压缩变量声明
             *
             * 在 exit 阶段处理，此时作用域内的所有节点都已遍历
             * 可以安全地判断变量是否被引用
             */
            Scopable: {
                exit(path) {
                    for (const [name, binding] of Object.entries(path.scope.bindings)) {
                        if (!binding.path?.node || !binding.path.isVariableDeclarator()) continue;

                        const init = binding.path.get('init');

                        // 没有 init 的声明（如函数参数），跳过
                        if (!init.node) continue;

                        // 只处理当前作用域的变量声明（不包括 hoisted 和 param）
                        if (binding.kind === 'hoisted' || binding.kind === 'param') continue;

                        /**
                         * binding.referencePaths
                         * 该变量所有引用的路径数组
                         * length > 0 表示变量被使用
                         */
                        const hasReferences = binding.referencePaths.length > 0;

                        /**
                         * path.scope.isPure(node)
                         * 判断表达式是否是纯的（无副作用）
                         * 纯表达式：字面量、标识符、纯函数调用
                         * 非纯表达式：赋值、有副作用的调用（如 console.log）
                         */
                        const isPure = path.scope.isPure(init.node);

                        /**
                         * 检查 PURE 注释
                         *
                         * / * @__PURE__ * / 放在函数调用前，标记该调用无副作用
                         * 例如：const x = / * @__PURE__ * / obj.method()
                         *
                         * 注释存储在节点的 leadingComments 属性中
                         */
                        const isPURE =
                            init.isCallExpression() &&
                            init.node.leadingComments?.[0]?.value.includes('PURE');

                        /**
                         * 内联策略：PURE 或纯字面量
                         *
                         * 对于有 PURE 注释的调用，或者纯字面量（如数字、字符串）：
                         * - 如果有引用：将所有引用替换为表达式本身
                         * - 然后删除变量声明
                         */
                        if (isPURE || (isPure && init.isLiteral())) {
                            if (hasReferences) {
                                binding.referencePaths.forEach((ref) => {
                                    if (ref.isIdentifier()) {
                                        // cloneNode: 克隆节点，避免引用冲突
                                        ref.replaceWith(t.cloneNode(init.node));
                                    }
                                });
                            }
                            // 只删除当前 declarator，避免误删同一条声明里的其他变量
                            removeDeclarator(binding.path);
                            continue;
                        }

                        /**
                         * 无引用的变量处理
                         */
                        if (!hasReferences) {
                            if (isPure) {
                                // 纯表达式（如 const x = 1;），直接删除
                                removeDeclarator(binding.path);
                            } else {
                                /**
                                 * 有副作用且无引用
                                 *
                                 * 例如：const unused = console.log('test');
                                 * 虽然变量未使用，但副作用（输出）需要保留
                                 *
                                 * 处理方式：
                                 * 1. 将 init 表达式（console.log('test')）包装为 ExpressionStatement
                                 * 2. 用这个语句替换 VariableDeclaration
                                 */
                                replaceDeclaratorWithExpression(
                                    binding.path,
                                    t.cloneNode(init.node)
                                );
                            }
                        }
                    }
                },
            },
        },
    };
});

module.exports = compressPlugin;
