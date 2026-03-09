const parser = require('@babel/parser');
const fs = require('fs');
const path = require('path');
const Scope = require('./runtime/scope');
const createInterpreter = require('./runtime/js-interpreter');

/**
 * 运行链路：
 * 1. 读取 sourceCode.js 的文本内容
 * 2. 用 @babel/parser 把文本转成 AST
 * 3. 把 AST 和全局作用域交给解释器执行
 * 4. 在控制台观察执行结果和报错定位信息
 */

// sourceCode.js 作为「被解释执行的输入代码」，这里按纯文本读取并交给 parser 生成 AST
const sourceCode = fs.readFileSync(path.join(__dirname, 'sourceCode.js'), 'utf-8');
// parser.parse 的结果是 File 节点，解释器入口同时支持 File / Program
const ast = parser.parse(sourceCode, {
    sourceType: 'unambiguous',
});

// createInterpreter 只负责「如何执行 AST」，全局内置对象通过 Scope 注入
const interpreter = createInterpreter();
const globalScope = new Scope();

// 在解释器中没有浏览器或 Node 的完整全局环境，需要手动注入最小能力
// 这里注入 console，保证 sourceCode 里的 console.log 可以执行
globalScope.set('console', {
    log: console.log.bind(console),
    error: console.error.bind(console),
    warn: console.warn.bind(console),
});

// 入口：直接从 File 节点开始执行，内部再分发到 Program
interpreter.run(ast, globalScope, sourceCode);
