import { describe, it, expect } from 'vitest';
const babel = require('@babel/core');
const eqOperatorLint = require('../plugins/eq-operator-lint');

describe('eqOperatorLint', () => {
    const transform = (code) => {
        let output;
        babel.transformSync(code, {
            plugins: [
                [
                    eqOperatorLint,
                    {
                        onResult: (errors) => {
                            output = errors;
                        },
                    },
                ],
            ],
            filename: 'test.js',
        });
        return output;
    };

    it('should detect == operator with different types', () => {
        const code = `foo == true;`;
        const errors = transform(code);
        expect(errors.length).toBe(1);
        expect(errors[0].message).toContain('===');
    });

    it('should detect != operator with different types', () => {
        const code = `bananas != 1;`;
        const errors = transform(code);
        expect(errors.length).toBe(1);
        expect(errors[0].message).toContain('!==');
    });

    it('should not report for === operator', () => {
        const code = `a === b;`;
        const errors = transform(code);
        expect(errors.length).toBe(0);
    });

    it('should not report for same type literals', () => {
        const code = `0 == 0; true == true; 'a' == 'b';`;
        const errors = transform(code);
        expect(errors.length).toBe(0);
    });

    it('should report typeof comparison with string', () => {
        const code = `typeof foo == 'undefined';`;
        const errors = transform(code);
        expect(errors.length).toBe(1);
    });

    it('should detect multiple violations', () => {
        const code = `
            foo == true;
            bananas != 1;
        `;
        const errors = transform(code);
        expect(errors.length).toBe(2);
    });
});
