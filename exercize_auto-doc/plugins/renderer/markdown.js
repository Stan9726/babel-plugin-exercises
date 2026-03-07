/**
 * 渲染文档数组为 Markdown 字符串
 * @param {Array} docs - 文档数据数组，每个元素可能是函数或类
 * @returns {string} Markdown 格式的文档字符串
 */
module.exports = function (docs) {
    let str = '';

    docs.forEach((doc) => {
        // 处理函数文档
        if (doc.type === 'function') {
            // 函数标题
            str += '## ' + doc.name + '\n';
            // 函数描述
            str += (doc.doc?.description || '') + '\n';
            // JSDoc tags（如 @param）
            if (doc.doc?.tags) {
                doc.doc.tags.forEach((tag) => {
                    str += tag.name + ': ' + tag.description + '\n';
                });
            }
            // 函数签名
            str += '>' + doc.name + '(';
            if (doc.params) {
                str += doc.params
                    .map((param) => {
                        return param.name + ': ' + (param.type || 'any');
                    })
                    .join(', ');
            }
            str += ')\n';
            // 返回类型
            if (doc.return) {
                str += '#### Returns: ' + doc.return + '\n';
            }
            // 参数列表
            str += '#### Parameters:\n';
            if (doc.params && doc.params.length > 0) {
                str += doc.params
                    .map((param) => {
                        return '- ' + param.name + ': ' + (param.type || 'any');
                    })
                    .join('\n');
            }
            str += '\n';

            // 处理类文档
        } else if (doc.type === 'class') {
            // 类标题
            str += '## ' + doc.name + '\n';
            // 类描述
            str += (doc.doc?.description || '') + '\n';
            // JSDoc tags
            if (doc.doc?.tags) {
                doc.doc.tags.forEach((tag) => {
                    str += tag.name + ': ' + tag.description + '\n';
                });
            }
            // 构造函数签名
            str += '> new ' + doc.name + '(';
            if (doc.constructors?.params) {
                str += doc.constructors.params
                    .map((param) => {
                        return param.name + ': ' + (param.type || 'any');
                    })
                    .join(', ');
            }
            str += ')\n';
            // 属性列表
            str += '#### Properties:\n';
            if (doc.propertiesInfo && doc.propertiesInfo.length > 0) {
                doc.propertiesInfo.forEach((prop) => {
                    str += '- ' + prop.name + ': ' + (prop.type || 'any') + '\n';
                });
            }
            // 方法列表
            str += '#### Methods:\n';
            if (doc.methodsInfo && doc.methodsInfo.length > 0) {
                doc.methodsInfo.forEach((method) => {
                    if (method.doc?.description) {
                        str += method.doc.description + '\n';
                    }
                    str += '- ' + method.name + '(';
                    if (method.params) {
                        str += method.params
                            .map((param) => {
                                return param.name + ': ' + (param.type || 'any');
                            })
                            .join(', ');
                    }
                    str += ')';
                    if (method.return) {
                        str += ': ' + method.return;
                    }
                    str += '\n';
                });
            }
            str += '\n';
        }
        str += '\n';
    });
    return str;
};
