const { codeFrameColumns } = require('@babel/code-frame');
const Scope = require('./scope');

/**
 * 当前解释器支持的最小语法子集，不在这个列表里的节点会抛错：
 * - Program / BlockStatement / ExpressionStatement
 * - VariableDeclaration / VariableDeclarator
 * - FunctionDeclaration / ReturnStatement / CallExpression
 * - Identifier / MemberExpression
 * - NumericLiteral / StringLiteral
 * - BinaryExpression（+ - * /）
 *
 * 解释器核心思路：
 * - 每个 AST 节点类型（node.type）对应一个同名处理函数
 * - evaluate 负责分发；各处理函数负责计算并返回结果
 * - 这和 Babel visitor 的「按节点类型处理」思维是一致的
 */
function createInterpreter() {
    /**
     * 根据 node.type 分发到对应解释函数
     * @param {object} node - 当前 AST 节点
     * @param {Scope} scope - 当前执行上下文（变量环境）
     * @returns {any} 当前节点计算结果（比如字面量值、函数调用返回值），或 ReturnSignal（用于在函数体里传递 return）
     */
    function evaluate(node, scope) {
        const interpreter = interpreters[node.type];
        if (!interpreter) {
            const error = new Error(`No interpreter for node type: ${node.type}`);
            error.node = node;
            throw error;
        }

        try {
            return interpreter(node, scope);
        } catch (e) {
            if (!e.node) {
                e.node = node;
            }
            throw e;
        }
    }

    const interpreters = {
        File(node, scope) {
            return evaluate(node.program, scope);
        },

        Program(node, scope) {
            // Program.body 是顶层语句数组，顺序执行即可
            // 类比在 JS 引擎里按文件从上到下执行
            for (const statement of node.body) {
                evaluate(statement, scope);
            }
            return undefined;
        },

        VariableDeclaration(node, scope) {
            // 一个声明语句可能包含多个声明项：const a = 1, b = 2;
            for (const declaration of node.declarations) {
                evaluate(declaration, scope);
            }
            return undefined;
        },

        VariableDeclarator(node, scope) {
            // 只允许在当前作用域声明一次，同层重复声明直接报错
            // node.id 对应变量名，node.init 对应右值表达式
            // 例如：const a = add(1, 2)
            // - id.name = "a"
            // - init 是 CallExpression
            const declareName = node.id.name;
            if (scope.hasOwn(declareName)) {
                throw new Error(`Identifier ${declareName} has already been declared`);
            }
            // init 是右值表达式，继续递归 evaluate
            const initValue = node.init ? evaluate(node.init, scope) : undefined;
            scope.set(declareName, initValue);
            return undefined;
        },

        ExpressionStatement(node, scope) {
            // 包装节点，真正可执行的是内部 expression
            return evaluate(node.expression, scope);
        },

        MemberExpression(node, scope) {
            // 例：console.log
            // object: console, property: log
            // 支持两种访问：
            // - 非计算属性：obj.prop
            // - 计算属性：obj[prop]
            const obj = evaluate(node.object, scope);
            const prop = node.computed ? evaluate(node.property, scope) : node.property.name;
            return obj[prop];
        },

        FunctionDeclaration(node, scope) {
            const declareName = node.id.name;
            if (scope.hasOwn(declareName)) {
                throw new Error(`Identifier ${declareName} has already been declared`);
            }

            // 函数声明会在当前作用域注册一个 JS 函数，用闭包保存定义时 scope
            scope.set(declareName, function (...args) {
                // 每次调用都创建函数作用域，并把参数名绑定到参数值
                // 例如 add(a, b) 在调用 add(1, 2) 后：
                // - funcScope 中 a=1, b=2
                const funcScope = new Scope(scope);
                for (const param of node.params) {
                    funcScope.set(param.name, args[node.params.indexOf(param)]);
                }

                // 返回语句通过 ReturnSignal 在 BlockStatement 中向上冒泡
                const result = evaluate(node.body, funcScope);
                if (result && result.type === 'ReturnSignal') {
                    return result.value;
                }
                // 没有 return 的函数默认返回 undefined
                return undefined;
            });
            return undefined;
        },

        ReturnStatement(node, scope) {
            // 用信号对象而不是直接 return，避免打断 JS 层的 evaluate 调用栈
            // 这个信号会被 BlockStatement 捕获并向外层传递，
            // 最终由 FunctionDeclaration 里的包装函数转成真实返回值
            return {
                type: 'ReturnSignal',
                value: node.argument ? evaluate(node.argument, scope) : undefined,
            };
        },

        BlockStatement(node, scope) {
            // 代码块按顺序执行；若遇到 ReturnSignal，立即向上层透传
            for (const statement of node.body) {
                const result = evaluate(statement, scope);
                if (result && result.type === 'ReturnSignal') {
                    return result;
                }
            }
            return undefined;
        },

        CallExpression(node, scope) {
            // 先计算参数列表，保证参数求值时机与 JS 一致（从左到右）
            const args = node.arguments.map((arg) => evaluate(arg, scope));
            if (node.callee.type === 'MemberExpression') {
                const obj = evaluate(node.callee.object, scope);
                const prop = node.callee.computed
                    ? evaluate(node.callee.property, scope)
                    : node.callee.property.name;
                const fn = obj[prop];
                if (typeof fn !== 'function') {
                    throw new TypeError(`${String(prop)} is not a function`);
                }
                // 成员调用要绑定 this = obj，例如 console.log 的 this 是 console
                return fn.apply(obj, args);
            }

            if (node.callee.type === 'Identifier') {
                // 普通函数调用：从作用域中取出函数后直接执行
                const fn = evaluate(node.callee, scope);
                if (typeof fn === 'function') {
                    return fn.apply(null, args);
                }
                throw new TypeError(`Identifier ${node.callee.name} is not a function`);
            }

            throw new Error(`Unsupported callee type: ${node.callee.type}`);
        },

        BinaryExpression(node, scope) {
            // 二元表达式递归求左右值，再按操作符计算
            // 例：double(add(base, 3))
            // add(base, 3) 内部的 "base + 3" 就会走到这里
            const left = evaluate(node.left, scope);
            const right = evaluate(node.right, scope);

            switch (node.operator) {
                case '+':
                    return left + right;
                case '-':
                    return left - right;
                case '*':
                    return left * right;
                case '/':
                    return left / right;
                default:
                    throw new Error(`Unsupported binary operator: ${node.operator}`);
            }
        },

        Identifier(node, scope) {
            // 变量读取统一走作用域链，不在链上就抛 ReferenceError
            if (!scope.has(node.name)) {
                throw new ReferenceError(`Identifier ${node.name} is not defined`);
            }
            return scope.get(node.name);
        },

        NumericLiteral(node) {
            return node.value;
        },

        StringLiteral(node) {
            return node.value;
        },
    };

    function run(program, scope, sourceCode, options) {
        try {
            // ast 是 File 节点，程序入口固定是 ast.program
            // sourceCode 只用于报错时打印 code frame，不参与计算
            return evaluate(program, scope);
        } catch (e) {
            // 统一错误出口：打印节点类型 + 源码定位，便于对照 AST 调试
            const node = e.node || program;
            if (!options?.silent) {
                console.error(`${node.type}: ${e.message}`);
                if (node.loc) {
                    console.error(
                        codeFrameColumns(sourceCode, node.loc, {
                            highlightCode: true,
                        })
                    );
                }
            }
            throw e;
        }
    }

    return {
        run,
    };
}

module.exports = createInterpreter;
