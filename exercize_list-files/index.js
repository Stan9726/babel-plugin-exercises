const { transformFileSync } = require('@babel/core');
const path = require('path');

// 入口：对 sourceCode.js 进行 Babel 编译，并触发宏展开
const sourceFilePath = path.resolve(__dirname, './sourceCode.js');

// babel-plugin-macros 会在编译期执行宏逻辑
const { code } = transformFileSync(sourceFilePath, {
    plugins: [['babel-plugin-macros']],
});

// 输出编译后的代码，便于观察宏替换结果
console.log(code);
