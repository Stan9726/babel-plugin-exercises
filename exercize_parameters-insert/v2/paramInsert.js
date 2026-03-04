const { parse } = require('@babel/parser');
const { stringLiteral } = require('@babel/types');
const traverse = require('@babel/traverse').default;
const generate = require('@babel/generator').default;

const sourceCode = `
    console.log(1);

    function func() {
        console.info(2);
    }

    export default class Clazz {
        say() {
            console.debug(3);
        }

        render() {
            return <div>{console.error(4)}</div>;
        }
    }
`;

const ast = parse(sourceCode, {
    sourceType: 'unambiguous',
    plugins: ['jsx'],
});

const targetCalleeName = ['log', 'info', 'error', 'debug'].map(
    (name) => `console.${name}`
);

traverse(ast, {
    CallExpression(path, state) {
        const calleeName = generate(path.node.callee).code;
        if (targetCalleeName.includes(calleeName)) {
            const { line, column } = path.node.loc.start;
            path.node.arguments.unshift(
                stringLiteral(`filename: (${line}, ${column})`)
            );
        }
    },
});

const { code } = generate(ast);
console.log(code);
