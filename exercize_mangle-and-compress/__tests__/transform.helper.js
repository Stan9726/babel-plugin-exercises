const { transformSync } = require('@babel/core');

/**
 * Helper function to transform code with plugins
 */
const transform = (code, plugins = []) => {
    return transformSync(code, {
        plugins,
        filename: 'test.js',
        parserOpts: {
            sourceType: 'unambiguous',
        },
    }).code;
};

export default transform;
