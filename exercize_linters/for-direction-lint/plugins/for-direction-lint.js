const { declare } = require('@babel/helper-plugin-utils');

const forDirectionLint = declare((api, options) => {
    api.assertVersion(7);

    return {
        pre: (file) => {
            file.set('forDirectionErrors', []);
        },

        visitor: {
            ForStatement: (path, state) => {
                const errors = state.file.get('forDirectionErrors');
                const testOperator = path.node.test?.operator;
                const updateOperator = path.node.update?.operator;

                let shouldUpdateOperator;

                if (['<', '<='].includes(testOperator)) {
                    shouldUpdateOperator = '++';
                } else if (['>', '>='].includes(testOperator)) {
                    shouldUpdateOperator = '--';
                }

                if (shouldUpdateOperator && shouldUpdateOperator !== updateOperator) {
                    const tmp = Error.stackTraceLimit;
                    Error.stackTraceLimit = 0;
                    errors.push(
                        path
                            .get('update')
                            .buildCodeFrameError(
                                `For loop update operator should be '${shouldUpdateOperator}' when test operator is '${testOperator}'`
                            )
                    );
                    Error.stackTraceLimit = tmp;
                }
            },
        },

        post(file) {
            console.log(file.get('forDirectionErrors'));
        },
    };
});

module.exports = forDirectionLint;
