import { describe, it, expect } from 'vitest';
const babel = require('@babel/core');
const forDirectionLint = require('../plugins/for-direction-lint');

describe('forDirectionLint', () => {
    const transform = (code) => {
        let output;
        babel.transformSync(code, {
            plugins: [
                [
                    forDirectionLint,
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

    it('should detect for loop with i-- when i < 10', () => {
        const code = `for (var i = 0; i < 10; i--) {}`;
        const errors = transform(code);
        expect(errors.length).toBe(1);
        expect(errors[0].message).toContain('++');
    });

    it('should detect for loop with i++ when i >= 0', () => {
        const code = `for (var i = 10; i >= 0; i++) {}`;
        const errors = transform(code);
        expect(errors.length).toBe(1);
        expect(errors[0].message).toContain('--');
    });

    it('should not report for correct direction with < and ++', () => {
        const code = `for (var i = 0; i < 10; i++) {}`;
        const errors = transform(code);
        expect(errors.length).toBe(0);
    });

    it('should not report for correct direction with >= and --', () => {
        const code = `for (var i = 10; i >= 0; i--) {}`;
        const errors = transform(code);
        expect(errors.length).toBe(0);
    });

    it('should not report for correct direction with <= and ++', () => {
        const code = `for (var i = 0; i <= 10; i++) {}`;
        const errors = transform(code);
        expect(errors.length).toBe(0);
    });

    it('should detect multiple violations', () => {
        const code = `
            for (var i = 0; i < 10; i--) {}
            for (var j = 10; j >= 0; j++) {}
        `;
        const errors = transform(code);
        expect(errors.length).toBe(2);
    });
});
