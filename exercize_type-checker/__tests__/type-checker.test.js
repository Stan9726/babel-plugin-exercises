import { describe, it, expect } from 'vitest';
const babel = require('@babel/core');
const typeCheckerPlugin = require('../plugins/type-checker');

describe('typeCheckerPlugin', () => {
    const transform = (code) => {
        let errors = [];
        babel.transformSync(code, {
            plugins: [
                [
                    typeCheckerPlugin,
                    {
                        onResult: (errs) => {
                            errors = errs;
                        },
                    },
                ],
            ],
            filename: 'test.ts',
            parserOpts: {
                plugins: ['typescript'],
            },
        });
        return errors;
    };

    describe('VariableDeclaration - type checking', () => {
        it('should report error when assigning number to string variable', () => {
            const errors = transform('let name: string = 123;');
            expect(errors.length).toBe(1);
            expect(errors[0].message).toContain('number');
            expect(errors[0].message).toContain('string');
        });

        it('should report error when assigning string to number variable', () => {
            const errors = transform('let num: number = "hello";');
            expect(errors.length).toBe(1);
            expect(errors[0].message).toContain('string');
            expect(errors[0].message).toContain('number');
        });

        it('should not report error when assigning correct types', () => {
            expect(transform('let name: string = "hello";').length).toBe(0);
            expect(transform('let num: number = 123;').length).toBe(0);
            expect(transform('let flag: boolean = true;').length).toBe(0);
        });

        it('should handle boolean assignment correctly', () => {
            const errors = transform('let flag: boolean = 1;');
            expect(errors.length).toBe(1);
        });
    });

    describe('CallExpression - parameter type checking', () => {
        it('should report error when argument type does not match parameter type', () => {
            const errors = transform('function add(a: number, b: number) {} add(1, "2");');
            expect(errors.length).toBe(1);
            expect(errors[0].message).toContain('string');
            expect(errors[0].message).toContain('number');
        });

        it('should report error when first argument type is wrong', () => {
            const errors = transform('function greet(msg: string) {} greet(123);');
            expect(errors.length).toBe(1);
            expect(errors[0].message).toContain('number');
        });

        it('should report error when argument count is less than expected', () => {
            const errors = transform('function add(a: number, b: number) {} add(1);');
            expect(errors.length).toBe(1);
            expect(errors[0].message).toContain('arguments');
        });

        it('should report error when argument count is more than expected', () => {
            const errors = transform('function add(a: number) {} add(1, 2);');
            expect(errors.length).toBe(1);
            expect(errors[0].message).toContain('arguments');
        });

        it('should not report error when arguments match', () => {
            const errors = transform('function add(a: number, b: number) {} add(1, 2);');
            expect(errors.length).toBe(0);
        });
    });

    describe('Generic Function - type parameter checking', () => {
        it('should report error when generic type parameter type does not match', () => {
            const errors = transform('function add<T>(a: T, b: T) {} add<number>(1, "2");');
            expect(errors.length).toBe(1);
            expect(errors[0].message).toContain('string');
        });

        it('should not report error when generic type matches', () => {
            const errors = transform(
                'function identity<T>(a: T): T { return a; } identity<number>(123);'
            );
            expect(errors.length).toBe(0);
        });

        it('should handle generic function with return type', () => {
            const errors = transform(
                'function identity<T>(a: T): T { return a; } identity<string>("hello");'
            );
            expect(errors.length).toBe(0);
        });
    });

    describe('Conditional Type - type evaluation', () => {
        it('should evaluate conditional type and report error', () => {
            const errors = transform(
                'type Res<T> = T extends 1 ? number : string; function add<T>(a: T) {} add<Res<1>>("hello");'
            );
            expect(errors.length).toBe(1);
            expect(errors[0].message).toContain('string');
        });

        it('should evaluate conditional type correctly when condition is true', () => {
            const errors = transform(
                'type Res<T> = T extends 1 ? number : string; function add<T>(a: T) {} add<Res<1>>(123);'
            );
            expect(errors.length).toBe(0);
        });

        it('should evaluate conditional type correctly when condition is false', () => {
            const errors = transform(
                'type Res<T> = T extends 1 ? number : string; function add<T>(a: T) {} add<Res<2>>("hello");'
            );
            expect(errors.length).toBe(0);
        });
    });

    describe('Override Checker - override modifier checking', () => {
        it('should report error when override method does not exist in parent', () => {
            const errors = transform(
                'class Parent { greet() {} } class Child extends Parent { override foo() {} }'
            );
            expect(errors.length).toBe(1);
            expect(errors[0].message).toContain('override');
            expect(errors[0].message).toContain('foo');
        });

        it('should not report error when override method exists in parent', () => {
            const errors = transform(
                'class Parent { greet() {} } class Child extends Parent { override greet() {} }'
            );
            expect(errors.length).toBe(0);
        });

        it('should not report error for non-override methods', () => {
            const errors = transform(
                'class Parent { greet() {} } class Child extends Parent { greet() {} }'
            );
            expect(errors.length).toBe(0);
        });

        it('should handle multiple override methods', () => {
            const errors = transform(
                'class Parent { a() {} b() {} } class Child extends Parent { override a() {} override b() {} }'
            );
            expect(errors.length).toBe(0);
        });

        it('should report error for one invalid override among valid ones', () => {
            const errors = transform(
                'class Parent { a() {} } class Child extends Parent { override a() {} override b() {} }'
            );
            expect(errors.length).toBe(1);
            expect(errors[0].message).toContain('b');
        });
    });

    describe('Edge Cases - edge cases', () => {
        it('should handle function without type annotations - no param types', () => {
            // Function params without type annotations are treated as unknown, not checked
            const errors = transform('function add(a, b) {} add(1, 2);');
            expect(errors.length).toBe(0);
        });

        it('should handle variable without type annotation', () => {
            const errors = transform('let name = "hello";');
            expect(errors.length).toBe(0);
        });

        it('should handle class without inheritance', () => {
            const errors = transform('class User { name: string; }');
            expect(errors.length).toBe(0);
        });

        it('should handle class extending non-existent parent', () => {
            const errors = transform('class Child extends Parent {}');
            expect(errors.length).toBe(0);
        });

        it('should handle multiple errors in one file', () => {
            const code = `
                let a: string = 123;
                function test(x: number) {}
                test("hello");
            `;
            const errors = transform(code);
            expect(errors.length).toBe(2);
        });
    });
});
