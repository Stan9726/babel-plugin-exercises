import { describe, it, expect } from 'vitest';
const acorn = require('acorn');
const XxxxKeywordPlugin = require('../XxxxKeywordPlugin');

describe('XxxxKeywordPlugin', () => {
    it('should parse xxxx as a keyword', () => {
        const parser = acorn.Parser.extend(XxxxKeywordPlugin);
        const code = 'xxxx';
        const result = parser.parse(code);
        
        expect(result.body).toHaveLength(1);
        expect(result.body[0].type).toBe('XxxxStatement');
        expect(result.body[0].value).toBe('xxxx');
    });

    it('should parse multiple xxxx statements', () => {
        const parser = acorn.Parser.extend(XxxxKeywordPlugin);
        const code = 'xxxx xxxx xxxx';
        const result = parser.parse(code);
        
        expect(result.body).toHaveLength(3);
        result.body.forEach(stmt => {
            expect(stmt.type).toBe('XxxxStatement');
            expect(stmt.value).toBe('xxxx');
        });
    });

    it('should parse xxxx with other statements', () => {
        const parser = acorn.Parser.extend(XxxxKeywordPlugin);
        const code = 'const a = 1; xxxx; const b = 2;';
        const result = parser.parse(code);
        
        expect(result.body.length).toBeGreaterThanOrEqual(2);
        const xxxxStatements = result.body.filter(stmt => stmt.type === 'XxxxStatement');
        expect(xxxxStatements).toHaveLength(1);
        expect(xxxxStatements[0].value).toBe('xxxx');
    });

    it('should handle xxxx in if statement', () => {
        const parser = acorn.Parser.extend(XxxxKeywordPlugin);
        const code = 'if (true) { xxxx }';
        const result = parser.parse(code);
        
        expect(result.body[0].type).toBe('IfStatement');
        expect(result.body[0].consequent.body[0].type).toBe('XxxxStatement');
    });
});
