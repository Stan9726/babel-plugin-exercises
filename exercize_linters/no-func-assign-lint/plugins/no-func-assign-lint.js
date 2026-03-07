const { declare } = require('@babel/helper-plugin-utils');

const noFuncAssignLint = declare((api, options) => {
    api.assertVersion(7);

    return {
        pre: (file) => {
            file.set('noFuncAssignErrors', []);
        },

        visitor: {
            AssignmentExpression: (path, state) => {
                const errors = state.file.get('noFuncAssignErrors');
                const assignTarget = path.get('left').toString();
                const binding = path.scope.getBinding(assignTarget);

                if (
                    binding?.path?.isFunctionDeclaration() ||
                    binding?.path?.isFunctionExpression()
                ) {
                    try {
                        const tmp = Error.stackTraceLimit;
                        Error.stackTraceLimit = 0;
                        const error = path
                            .get('left')
                            .buildCodeFrameError(
                                `Assignment to function '${assignTarget}' is not allowed`
                            );
                        errors.push(error);
                        Error.stackTraceLimit = tmp;
                    } catch (e) {
                        errors.push(e);
                    }
                }
            },
        },

        post(file) {
            if (options?.onResult) {
                const errors = file.get('noFuncAssignErrors');
                options.onResult(errors);
            }
        },
    };
});

module.exports = noFuncAssignLint;
