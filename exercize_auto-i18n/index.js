const { transformFromAstSync } = require('@babel/core');
const parser = require('@babel/parser');
const autoI18nPlugin = require('./plugins/auto-i18n-plugin');
const fs = require('fs');
const path = require('path');

const sourceCode = fs.readFileSync(path.join(__dirname, './sourceCode.jsx'), {
    encoding: 'utf-8',
});

const ast = parser.parse(sourceCode, {
    sourceType: 'unambiguous',
    plugins: ['jsx'],
});

const { code } = transformFromAstSync(ast, sourceCode, {
    plugins: [
        [
            autoI18nPlugin,
            {
                outputDir: path.join(__dirname, './locales'),
            },
        ],
    ],
});

console.log(code);
