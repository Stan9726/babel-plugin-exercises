const fs = require('fs');
const path = require('path');

// 根据文件后缀启用语法插件（仅用于解析，不做转换）
const resolveBabelSyntaxPlugins = (modulePath) => {
    const plugins = [];
    if (modulePath.endsWith('.ts') || modulePath.endsWith('.tsx')) {
        plugins.push('typescript');
    }
    if (modulePath.endsWith('.jsx') || modulePath.endsWith('.tsx')) {
        plugins.push('jsx');
    }
    return plugins;
};

// 判断路径是否是目录
const isDirectory = (filePath) => {
    return fs.existsSync(filePath) && fs.statSync(filePath).isDirectory();
};

/**
 * 补全模块路径：
 * 1) 没有后缀时尝试 .js/.jsx/.ts/.tsx
 * 2) 如果是目录则尝试 index.*
 */
const completeModulePath = (modulePath) => {
    const extensions = ['.js', '.jsx', '.ts', '.tsx']; // 支持的后缀列表
    if (modulePath.match(/\.[a-z]+$/)) {
        return modulePath; // 已带后缀，直接返回
    }

    const tryCompletePath = (resolvePath) => {
        // 尝试为路径拼接不同后缀
        for (const ext of extensions) {
            const fullPath = `${resolvePath}${ext}`; // 组合成完整文件路径
            if (fs.existsSync(fullPath)) {
                return fullPath; // 找到真实文件就返回
            }
        }
    };

    const reportModuleNotFound = () => {
        throw new Error(`Module not found: ${modulePath}`);
    };

    if (isDirectory(modulePath)) {
        // 如果是目录，优先尝试目录下的 index.*
        const tryModulePath = tryCompletePath(path.join(modulePath, 'index'));
        if (!tryModulePath) {
            reportModuleNotFound();
        }
        return tryModulePath;
    }

    // 如果不是目录且没后缀，尝试补全后缀
    const tryModulePath = tryCompletePath(modulePath);
    if (!tryModulePath) {
        reportModuleNotFound();
    }
    return tryModulePath;
};

// 解析 import 源路径，只解析本地文件路径
const resolveModulePath = (curModulePath, rawImportPath) => {
    const isRelative = rawImportPath.startsWith('.') || rawImportPath.startsWith('/'); // 只处理本地路径
    if (!isRelative) {
        return ''; // 裸模块（如 react）直接跳过
    }

    // 以当前文件所在目录为基准，把相对路径转成绝对路径
    let resolvedPath = path.resolve(path.dirname(curModulePath), rawImportPath); // 转成绝对路径
    if (resolvedPath.includes(`${path.sep}node_modules${path.sep}`)) {
        return ''; // 暂不处理 node_modules
    }

    // 补全后缀或 index.*，确保指向真实文件
    return completeModulePath(resolvedPath);
};

module.exports = {
    resolveBabelSyntaxPlugins,
    completeModulePath,
    resolveModulePath,
};
