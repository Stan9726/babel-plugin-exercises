const { relative } = require('path');

const targetCalleeName = ['log', 'info', 'error', 'debug'].map(
    (name) => `console.${name}`
);

const paramInsertPlugin = ({ types }) => {
    return {
        visitor: {
            CallExpression(path, state) {
                if (path.node.isNew) {
                    return;
                }
                const calleeName = path.get('callee').toString();
                if (targetCalleeName.includes(calleeName)) {
                    const { line, column } = path.node.loc.start;
                    const relativePath = relative(
                        process.cwd(),
                        state.filename
                    );

                    const newNode = types.callExpression(
                        types.memberExpression(
                            types.identifier('console'),
                            types.identifier('log')
                        ),
                        [
                            types.stringLiteral(
                                `filename: ${relativePath} (${line}, ${column})`
                            ),
                        ]
                    );
                    newNode.isNew = true;
                    if (path.findParent((path) => path.isJSXElement())) {
                        path.replaceWith(
                            types.arrayExpression([newNode, path.node])
                        );
                        path.skip();
                    } else {
                        path.insertBefore(types.expressionStatement(newNode));
                    }
                }
            },
        },
    };
};

module.exports = paramInsertPlugin;
