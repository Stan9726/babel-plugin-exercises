import { describe, it, expect } from 'vitest';
import transform from './transform.helper';
const compressPlugin = require('../plugins/compress-plugin');

describe('compressPlugin', () => {
    describe('Dead Code Elimination', () => {
        it('should remove unreachable code after return', () => {
            const input = 'function f() { return 1; console.log("unreachable"); }';
            const output = transform(input, [compressPlugin]);

            expect(output).not.toContain('console.log("unreachable")');
        });

        it('should keep function declaration after return', () => {
            const input = 'function f() { return 1; function helper() {} }';
            const output = transform(input, [compressPlugin]);

            // Function declarations are hoisted, should be kept
            expect(output).toContain('function helper()');
        });

        it('should handle multiple unreachable statements', () => {
            const input = `
                function f() {
                    return 1;
                    console.log(1);
                    console.log(2);
                    console.log(3);
                }
            `;
            const output = transform(input, [compressPlugin]);

            expect(output).not.toContain('console.log(1)');
            expect(output).not.toContain('console.log(2)');
            expect(output).not.toContain('console.log(3)');
        });
    });

    describe('Unused Variable Removal', () => {
        it('should remove unused const variable', () => {
            const input = 'function f() { const unused = 1; return 2; }';
            const output = transform(input, [compressPlugin]);

            expect(output).not.toContain('const unused = 1');
        });

        it('should remove unused let variable', () => {
            const input = 'function f() { let unused = 2; return 3; }';
            const output = transform(input, [compressPlugin]);

            expect(output).not.toContain('let unused = 2');
        });

        it('should keep used variable', () => {
            const input = 'function f() { const used = 42; return used; }';
            const output = transform(input, [compressPlugin]);

            expect(output).toContain('return 42');
        });

        it('should only remove the unused declarator in a multi-declaration statement', () => {
            const input = 'function f() { const unused = 1, used = 2; return used; }';
            const output = transform(input, [compressPlugin]);

            expect(output).not.toContain('unused');
            expect(output).toContain('return 2;');
        });
    });

    describe('Constant Inlining', () => {
        it('should inline numeric literal', () => {
            const input = 'function f() { const num = 42; return num; }';
            const output = transform(input, [compressPlugin]);

            expect(output).toBe('function f() {\n  return 42;\n}');
        });

        it('should inline string literal', () => {
            const input = 'function f() { const str = "hello"; return str; }';
            const output = transform(input, [compressPlugin]);

            expect(output).toBe('function f() {\n  return "hello";\n}');
        });

        it('should inline multiple references', () => {
            const input = 'function f() { const num = 42; return num + num; }';
            const output = transform(input, [compressPlugin]);

            expect(output).toBe('function f() {\n  return 42 + 42;\n}');
        });
    });

    describe('PURE Annotation handling', () => {
        it('should remove PURE call without references', () => {
            const input = 'function f() { const x = /*@__PURE__*/obj.method(); return 1; }';
            const output = transform(input, [compressPlugin]);

            expect(output).not.toContain('PURE');
            expect(output).not.toContain('obj.method()');
        });

        it('should inline PURE call with references', () => {
            const input = 'function f() { const x = /*@__PURE__*/obj.method(); return x; }';
            const output = transform(input, [compressPlugin]);

            expect(output).not.toContain('const x');
            expect(output).toContain('obj.method()');
        });

        it('should handle PURE comment with spaces', () => {
            const input = 'function f() { const x = /* @__PURE__ */obj.method(); return x; }';
            const output = transform(input, [compressPlugin]);

            expect(output).toContain('obj.method()');
        });
    });

    describe('Side Effect Preservation', () => {
        it('should keep side effect call without references', () => {
            const input = 'function f() { const unused = console.log("test"); return 1; }';
            const output = transform(input, [compressPlugin]);

            expect(output).toContain('console.log("test")');
            expect(output).not.toContain('const unused');
        });

        it('should convert variable declaration to expression statement', () => {
            const input = 'function f() { const unused = console.log("test"); return 1; }';
            const output = transform(input, [compressPlugin]);

            expect(output).not.toContain('const');
            expect(output).toMatch(/console\.log\("test"\);/);
        });

        it('should preserve sibling declarators when extracting side effects', () => {
            const input =
                'function f() { const unused = console.log("test"), used = 2; return used; }';
            const output = transform(input, [compressPlugin]);

            expect(output).toContain('console.log("test");');
            expect(output).toContain('return 2;');
        });
    });
});
