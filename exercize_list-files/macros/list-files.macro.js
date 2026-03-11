const { createMacro } = require('babel-plugin-macros');
const path = require('path');
const fs = require('fs');

function listFiles({ references, state, babel }) {
    // 只处理默认导入：const files = require('./files.macro')
    const { default: referredPaths = [] } = references;

    referredPaths.forEach((referredPath) => {
        // 取出调用参数：files('./dir') 中的 './dir'
        const argPath = referredPath.parentPath.get('arguments.0');
        if (!argPath || !argPath.node || argPath.node.type !== 'StringLiteral') {
            throw new Error('files.macro expects a single string literal path argument.');
        }

        // 以当前源文件所在目录为基准，拼出真实目录路径
        const dirPath = path.resolve(path.dirname(state.filename), argPath.node.value);
        if (!fs.existsSync(dirPath)) {
            throw new Error(`files.macro cannot find directory: ${dirPath}`);
        }
        // 读取目录下文件名
        const fileNames = fs
            .readdirSync(dirPath)
            .filter((fileName) => fs.statSync(path.join(dirPath, fileName)).isFile())
            .sort();

        // 构建 AST：["a.js", "b.ts"]
        const ast = babel.types.arrayExpression(
            fileNames.map((fileName) => babel.types.stringLiteral(fileName))
        );

        // 用数组字面量替换原来的 files('./dir') 调用
        referredPath.parentPath.replaceWith(ast);
    });
}

// 以宏形式导出，让 babel-plugin-macros 在编译期执行
module.exports = createMacro(listFiles);
