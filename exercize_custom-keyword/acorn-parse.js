const acorn = require('acorn');
const XxxxKeywordPlugin = require('./XxxxKeywordPlugin');

const Parser = acorn.Parser;
const newParser = Parser.extend(XxxxKeywordPlugin);

var program = `
    xxxx;
    const a = 1;
`;

const ast = newParser.parse(program);
console.log(ast);
