const { declare } = require('@babel/helper-plugin-utils');

const eqOperatorLint = declare((api, options) => {
    api.assertVersion(7);

    return {
        pre: (file) => {
            file.set('eqOperatorErrors', []);
        },

        visitor: {
            BinaryExpression: (path, state) => {
                const errors = state.file.get('eqOperatorErrors');
                const operator = path.node.operator;

                if (operator === '==' || operator === '!=') {
                    const left = path.get('left');
                    const right = path.get('right');

                    if (
                        left.node &&
                        right.node &&
                        !(left.isLiteral() && right.isLiteral()) &&
                        typeof left.node.value !== typeof right.node.value
                    ) {
                        try {
                            const tmp = Error.stackTraceLimit;
                            Error.stackTraceLimit = 0;
                            const error = path.buildCodeFrameError(
                                `Use '${operator === '==' ? '===' : '!=='}' instead of '${operator}' for strict equality check`
                            );
                            errors.push(error);
                            Error.stackTraceLimit = tmp;
                        } catch (e) {
                            errors.push(e);
                        }
                    }
                }
            },
        },

        post(file) {
            if (options?.onResult) {
                const errors = file.get('eqOperatorErrors');
                options.onResult(errors);
            }
        },
    };
});

module.exports = eqOperatorLint;
