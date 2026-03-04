const { transformFileSync } = require('@babel/core');
const { join } = require('path');
const paramInsertPlugin = require('./plugins/param-insert-plugin');

const { code } = transformFileSync(join(__dirname, './sourceCode.jsx'), {
    plugins: [paramInsertPlugin],
    parserOpts: {
        sourceType: 'unambiguous',
        plugins: ['jsx'],
    },
});

console.log(code);
