const { parse } = require('@babel/parser');
const {
    callExpression,
    memberExpression,
    identifier,
    stringLiteral,
    expressionStatement,
    arrayExpression,
} = require('@babel/types');
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
        if (path.node.isNew) {
            return;
        }
        const calleeName = path.get('callee').toString();
        if (targetCalleeName.includes(calleeName)) {
            const { line, column } = path.node.loc.start;
            const newNode = callExpression(
                memberExpression(identifier('console'), identifier('log')),
                [stringLiteral(`filename: (${line}, ${column})`)]
            );
            newNode.isNew = true;
            if (path.findParent((path) => path.isJSXElement())) {
                path.replaceWith(arrayExpression([newNode, path.node]));
                path.skip();
            } else {
                path.insertBefore(expressionStatement(newNode));
            }
        }
    },
});

const { code } = generate(ast);
console.log(code);
