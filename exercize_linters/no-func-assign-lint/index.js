const { transformFromAstSync } = require('@babel/core');
const parser = require('@babel/parser');
const noFuncAssignLint = require('./plugins/no-func-assign-lint');

const sourceCode = `
    function foo() {
        foo = bar;
    }

    var a = function hello() {
    hello = 123;
    };
`;

const ast = parser.parse(sourceCode, {
    sourceType: 'unambiguous',
});

transformFromAstSync(ast, sourceCode, {
    plugins: [
        [
            noFuncAssignLint,
            {
                onResult: (errors) => {
                    console.log(errors);
                },
            },
        ],
    ],
    filename: 'input.js',
});
