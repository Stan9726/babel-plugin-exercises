import { describe, it, expect } from 'vitest';
import transform from './transform.helper';
const manglePlugin = require('../plugins/mangle-plugin');

/**
 * ==================== mangle-plugin tests ====================
 */
describe('manglePlugin', () => {
    describe('FunctionDeclaration - function name mangling', () => {
        it('should mangle function name in global scope', () => {
            const input = 'function func() {} func();';
            const output = transform(input, [manglePlugin]);

            expect(output).not.toContain('function func()');
            expect(output).toMatch(/function _\w+\(\)/);
        });

        it('should mangle nested function name', () => {
            const input =
                'function outer() { function inner() { return inner(); } return outer(); }';
            const output = transform(input, [manglePlugin]);

            expect(output).not.toContain('function inner()');
            expect(output).toMatch(/function _\w+\(\)/);
        });

        it('should update function call reference', () => {
            const input = 'function func() {} func();';
            const output = transform(input, [manglePlugin]);

            expect(output).not.toContain('func()');
            expect(output).toMatch(/_\w+\(\)/);
        });
    });

    describe('VariableDeclaration - variable name mangling', () => {
        it('should mangle const variable', () => {
            const input = 'function f() { const a = 1; return a; }';
            const output = transform(input, [manglePlugin]);

            expect(output).not.toContain('const a = 1');
            expect(output).toMatch(/const _\w+ = 1/);
        });

        it('should mangle let variable', () => {
            const input = 'function f() { let b = 2; return b; }';
            const output = transform(input, [manglePlugin]);

            expect(output).not.toContain('let b = 2');
            expect(output).toMatch(/let _\w+ = 2/);
        });

        it('should mangle var variable', () => {
            const input = 'function f() { var c = 3; return c; }';
            const output = transform(input, [manglePlugin]);

            expect(output).not.toContain('var c = 3');
            expect(output).toMatch(/var _\w+ = 3/);
        });

        it('should update variable references', () => {
            const input = 'function f() { const num = 42; return num + num; }';
            const output = transform(input, [manglePlugin]);

            expect(output).not.toContain('num');
            expect(output).toMatch(/return _\w+ \+ _\w+/);
        });
    });

    describe('Function Parameters - parameter name mangling', () => {
        it('should mangle function parameters', () => {
            const input = 'function add(a, b) { return a + b; }';
            const output = transform(input, [manglePlugin]);

            expect(output).not.toMatch(/function add\(a, b\)/);
            expect(output).toMatch(/\(_\w+, _\w+\)/);
        });

        it('should mangle nested function parameters', () => {
            const input = 'function outer(x) { function inner(y) { return y; } return x; }';
            const output = transform(input, [manglePlugin]);

            expect(output).not.toContain('function inner(y)');
            expect(output).not.toContain('function outer(x)');
            expect(output).toMatch(/\(_\w+\)/);
        });

        it('should update parameter references', () => {
            const input = 'function add(x, y) { return x + y; }';
            const output = transform(input, [manglePlugin]);

            expect(output).not.toMatch(/x \+ y/);
            expect(output).toMatch(/_\w+ \+ _\w+/);
        });
    });

    describe('Scope handling', () => {
        it('should mangle global variables (simplified for learning)', () => {
            const input = 'const global = 1; function f() { return global; }';
            const output = transform(input, [manglePlugin]);

            // Current simplified implementation mangles global variables
            // Production would need complex logic to identify real globals
            expect(output).not.toContain('global');
            expect(output).toContain('const _');
        });

        it('should handle nested scopes correctly', () => {
            const input = `
                function outer() {
                    const a = 1;
                    function inner() {
                        const b = 2;
                        return a + b;
                    }
                    return a;
                }
            `;
            const output = transform(input, [manglePlugin]);

            expect(output).not.toContain('const a = 1');
            expect(output).not.toContain('const b = 2');
        });
    });
});
