const acorn = require('acorn');

const Parser = acorn.Parser;
const TokenType = acorn.TokenType;

Parser.acorn.keywordTypes['xxxx'] = new TokenType('xxxx', { keyword: 'xxxx' });

module.exports = (Parser) => {
    return class extends Parser {
        parse(program) {
            let newKeywords =
                'break case catch continue debugger default do else finally for function if return switch throw try var while with null true false instanceof typeof void delete new in this const class extends export import super';
            newKeywords += ' xxxx';
            this.keywords = new RegExp(
                '^(?:' + newKeywords.replace(/ /g, '|') + ')$'
            );
            return super.parse(program);
        }

        parseStatement(context, topLevel, exports) {
            const startType = this.type;

            if (startType === Parser.acorn.keywordTypes['xxxx']) {
                return this.parseXxxxStatement();
            } else {
                return super.parseStatement(context, topLevel, exports);
            }
        }

        parseXxxxStatement() {
            this.next();
            return this.finishNode({ value: 'xxxx' }, 'XxxxStatement');
        }
    };
};
