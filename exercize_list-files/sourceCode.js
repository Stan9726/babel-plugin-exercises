// 引入自定义 macro：在编译期把 files('./dir') 替换成文件名数组
const files = require('./macros/list-files.macro');

// 运行后（编译结果中）会被替换成具体文件名数组
console.log('src files:');
console.log(files('./src'));
console.log('macro files:');
console.log(files('./macros'));
