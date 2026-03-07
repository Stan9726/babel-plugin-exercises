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
                    const tmp = Error.stackTraceLimit;
                    Error.stackTraceLimit = 0;
                    errors.push(
                        path
                            .get('left')
                            .buildCodeFrameError(
                                `Assignment to function '${assignTarget}' is not allowed`
                            )
                    );
                    Error.stackTraceLimit = tmp;
                }
            },
        },

        post(file) {
            console.log(file.get('noFuncAssignErrors'));
        },
    };
});

module.exports = noFuncAssignLint;
