const { parse } = require('@babel/parser');
const { isMemberExpression, stringLiteral } = require('@babel/types');
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

traverse(ast, {
    CallExpression(path, state) {
        if (
            isMemberExpression(path.node.callee) &&
            path.node.callee.object.name === 'console' &&
            ['log', 'info', 'error', 'debug'].includes(
                path.node.callee.property.name
            )
        ) {
            const { line, column } = path.node.loc.start;
            path.node.arguments.unshift(
                stringLiteral(`filename: (${line}, ${column})`)
            );
        }
    },
});

const { code } = generate(ast);
console.log(code);
