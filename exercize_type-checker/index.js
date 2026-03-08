/**
 * Type Checker Plugin 测试入口
 *
 * 使用方法:
 *   node src/combined-entry.js
 *
 * 测试用例说明:
 *   1. variableDeclarator - 变量声明类型检查
 *   2. callExpression - 函数调用参数检查
 *   3. genericFunction - 泛型函数检查
 *   4. conditionalType - 条件类型检查
 *   5. overrideChecker - override 修饰符检查
 */

const { transformFromAstSync } = require('@babel/core');
const parser = require('@babel/parser');
const typeCheckerPlugin = require('./plugins/type-checker');

// 测试用例定义
const testCases = {
    // 用例1: 变量声明类型检查
    // 检测: let name: string = 111;
    // 预期: 报错 - number 不能赋值给 string
    variableDeclarator: `
        let name: string = 111;
    `,

    // 用例2: 函数调用参数检查
    // 检测: add(1, '2') - 第二个参数类型错误
    // 预期: 报错 - string 不能赋值给 number
    callExpression: `
        function add(a: number, b: number): number {
            return a + b;
        }
        add(1, '2');
    `,

    // 用例3: 泛型函数检查
    // 检测: add<number>(1, '2') - 泛型约束检查
    // 预期: 报错 - string 不能赋值给 number
    genericFunction: `
        function add<T>(a: T, b: T) {
            return a + b;
        }
        add<number>(1, '2');
    `,

    // 用例4: 条件类型检查
    // 检测: add<Res<1>>(1, '2') - 条件类型求值后检查
    // 预期: 报错 - Res<1> 求值为 number
    conditionalType: `
        type Res<Param> = Param extends 1 ? number : string;
        function add<T>(a: T, b: T) {
            return a + b;
        }
        add<Res<1>>(1, '2');
    `,

    // 用例5: override 修饰符检查
    // 检测: override 一个父类不存在的方法
    // 预期: 报错 - foo 方法不在 Parent 中
    overrideCheckerError: `
        class Parent {
            greet() {}
        }
        class Child extends Parent {
            override foo() {}
        }
    `,
};

/**
 * 执行单个测试用例
 * @param {string} name - 用例名称
 * @param {string} sourceCode - 待检测的源代码
 */
function testCase(name, sourceCode) {
    console.log(`\n=== ${name} ===`);

    const ast = parser.parse(sourceCode, {
        sourceType: 'unambiguous',
        plugins: ['typescript'],
    });

    transformFromAstSync(ast, sourceCode, {
        plugins: [
            [
                typeCheckerPlugin,
                {
                    onResult: (errs) => {
                        errs.forEach((err) => console.log(err.message));
                    },
                },
            ],
        ],
    });
}

// 依次执行所有测试用例
testCase('Variable Declarator', testCases.variableDeclarator);
testCase('Call Expression', testCases.callExpression);
testCase('Generic Function', testCases.genericFunction);
testCase('Conditional Type', testCases.conditionalType);
testCase('Override Checker', testCases.overrideCheckerError);
