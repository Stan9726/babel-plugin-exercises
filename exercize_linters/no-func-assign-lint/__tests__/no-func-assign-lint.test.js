import { describe, it, expect } from 'vitest';
const babel = require('@babel/core');
const noFuncAssignLint = require('../plugins/no-func-assign-lint');

describe('noFuncAssignLint', () => {
    const transform = (code) => {
        let output;
        babel.transformSync(code, {
            plugins: [
                [
                    noFuncAssignLint,
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

    it('should detect assignment to function declaration', () => {
        const code = `
            function foo() {
                foo = bar;
            }
        `;
        const errors = transform(code);
        expect(errors.length).toBe(1);
        expect(errors[0].message).toContain('Assignment to function');
    });

    it('should detect assignment to function expression', () => {
        const code = `
            var a = function hello() {
                hello = 123;
            };
        `;
        const errors = transform(code);
        expect(errors.length).toBe(1);
        expect(errors[0].message).toContain('Assignment to function');
    });

    it('should not report for normal variable assignment', () => {
        const code = `
            var x = 1;
            x = 2;
        `;
        const errors = transform(code);
        expect(errors.length).toBe(0);
    });

    it('should not report for assignment to object property', () => {
        const code = `
            var obj = { x: 1 };
            obj.x = 2;
        `;
        const errors = transform(code);
        expect(errors.length).toBe(0);
    });

    it('should detect multiple violations', () => {
        const code = `
            function foo() { foo = 1; }
            function bar() { bar = 2; }
        `;
        const errors = transform(code);
        expect(errors.length).toBe(2);
    });
});
