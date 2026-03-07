import { describe, it, expect, beforeEach, afterEach } from 'vitest';
const babel = require('@babel/core');
const autoDocPlugin = require('../plugins/auto-doc-plugin');
const fs = require('fs');
const path = require('path');

describe('autoDocPlugin', () => {
    let tempDir;

    beforeEach(() => {
        tempDir = fs.mkdtempSync('/tmp/auto-doc-test-');
    });

    afterEach(() => {
        fs.rmSync(tempDir, { recursive: true, force: true });
    });

    const transform = (code, options = {}) => {
        return babel.transformSync(code, {
            plugins: [[autoDocPlugin, { ...options, outputDir: tempDir }]],
            filename: 'test.ts',
            parserOpts: {
                plugins: ['typescript'],
            },
        });
    };

    describe('FunctionDeclaration', () => {
        it('should extract function name', () => {
            const code = 'function sayHi() {}';
            transform(code);

            const doc = fs.readFileSync(path.join(tempDir, 'api-doc.md'), 'utf-8');
            expect(doc).toContain('## sayHi');
        });

        it('should extract function parameters', () => {
            const code = 'function sayHi(name: string, age: number) {}';
            transform(code);

            const doc = fs.readFileSync(path.join(tempDir, 'api-doc.md'), 'utf-8');
            expect(doc).toContain('name: string');
            expect(doc).toContain('age: number');
        });

        it('should extract function return type', () => {
            const code = 'function sayHi(): string { return ""; }';
            transform(code);

            const doc = fs.readFileSync(path.join(tempDir, 'api-doc.md'), 'utf-8');
            expect(doc).toContain('Returns: string');
        });

        it('should extract JSDoc description', () => {
            const code = `
                /**
                 * This is a greeting function
                 */
                function sayHi() {}
            `;
            transform(code);

            const doc = fs.readFileSync(path.join(tempDir, 'api-doc.md'), 'utf-8');
            expect(doc).toContain('This is a greeting function');
        });

        it('should extract JSDoc @param tags', () => {
            const code = `
                /**
                 * @param name - The name parameter
                 * @param age - The age parameter
                 */
                function sayHi(name: string, age: number) {}
            `;
            transform(code);

            const doc = fs.readFileSync(path.join(tempDir, 'api-doc.md'), 'utf-8');
            expect(doc).toContain('name: The name parameter');
            expect(doc).toContain('age: The age parameter');
        });

        it('should handle boolean parameter', () => {
            const code = 'function test(flag: boolean) {}';
            transform(code);

            const doc = fs.readFileSync(path.join(tempDir, 'api-doc.md'), 'utf-8');
            expect(doc).toContain('flag: boolean');
        });
    });

    describe('ClassDeclaration', () => {
        it('should extract class name', () => {
            const code = 'class User {}';
            transform(code);

            const doc = fs.readFileSync(path.join(tempDir, 'api-doc.md'), 'utf-8');
            expect(doc).toContain('## User');
        });

        it('should extract class properties', () => {
            const code = `
                class User {
                    name: string;
                    age: number;
                }
            `;
            transform(code);

            const doc = fs.readFileSync(path.join(tempDir, 'api-doc.md'), 'utf-8');
            expect(doc).toContain('name: string');
            expect(doc).toContain('age: number');
        });

        it('should extract constructor parameters', () => {
            const code = `
                class User {
                    constructor(name: string, age: number) {}
                }
            `;
            transform(code);

            const doc = fs.readFileSync(path.join(tempDir, 'api-doc.md'), 'utf-8');
            expect(doc).toContain('new User(name: string, age: number)');
        });

        it('should extract class methods', () => {
            const code = `
                class User {
                    getName() {}
                }
            `;
            transform(code);

            const doc = fs.readFileSync(path.join(tempDir, 'api-doc.md'), 'utf-8');
            expect(doc).toContain('getName()');
        });

        it('should extract method return type', () => {
            const code = `
                class User {
                    getName(): string { return ""; }
                }
            `;
            transform(code);

            const doc = fs.readFileSync(path.join(tempDir, 'api-doc.md'), 'utf-8');
            expect(doc).toContain('getName(): string');
        });

        it('should extract method parameters', () => {
            const code = `
                class User {
                    greet(message: string): string { return ""; }
                }
            `;
            transform(code);

            const doc = fs.readFileSync(path.join(tempDir, 'api-doc.md'), 'utf-8');
            expect(doc).toContain('greet(message: string): string');
        });

        it('should extract class JSDoc description', () => {
            const code = `
                /**
                 * User class for managing user data
                 */
                class User {}
            `;
            transform(code);

            const doc = fs.readFileSync(path.join(tempDir, 'api-doc.md'), 'utf-8');
            expect(doc).toContain('User class for managing user data');
        });

        it('should extract method JSDoc', () => {
            const code = `
                class User {
                    /**
                     * Get user name
                     */
                    getName(): string { return ""; }
                }
            `;
            transform(code);

            const doc = fs.readFileSync(path.join(tempDir, 'api-doc.md'), 'utf-8');
            expect(doc).toContain('Get user name');
        });
    });

    describe('Multiple declarations', () => {
        it('should handle multiple functions', () => {
            const code = `
                function foo() {}
                function bar() {}
            `;
            transform(code);

            const doc = fs.readFileSync(path.join(tempDir, 'api-doc.md'), 'utf-8');
            expect(doc).toContain('## foo');
            expect(doc).toContain('## bar');
        });

        it('should handle multiple classes', () => {
            const code = `
                class Foo {}
                class Bar {}
            `;
            transform(code);

            const doc = fs.readFileSync(path.join(tempDir, 'api-doc.md'), 'utf-8');
            expect(doc).toContain('## Foo');
            expect(doc).toContain('## Bar');
        });

        it('should handle mixed functions and classes', () => {
            const code = `
                function sayHi() {}
                class User {
                    name: string;
                }
            `;
            transform(code);

            const doc = fs.readFileSync(path.join(tempDir, 'api-doc.md'), 'utf-8');
            expect(doc).toContain('## sayHi');
            expect(doc).toContain('## User');
        });
    });

    describe('Edge cases', () => {
        it('should handle function without parameters', () => {
            const code = 'function sayHi() {}';
            transform(code);

            const doc = fs.readFileSync(path.join(tempDir, 'api-doc.md'), 'utf-8');
            expect(doc).toContain('sayHi()');
        });

        it('should handle class without constructor', () => {
            const code = 'class User { name: string; }';
            transform(code);

            const doc = fs.readFileSync(path.join(tempDir, 'api-doc.md'), 'utf-8');
            expect(doc).toContain('new User()');
        });

        it('should handle class without methods', () => {
            const code = 'class User { name: string; }';
            transform(code);

            const doc = fs.readFileSync(path.join(tempDir, 'api-doc.md'), 'utf-8');
            expect(doc).toContain('#### Methods:');
        });

        it('should handle class without properties', () => {
            const code = 'class User { sayHi() {} }';
            transform(code);

            const doc = fs.readFileSync(path.join(tempDir, 'api-doc.md'), 'utf-8');
            expect(doc).toContain('#### Properties:');
        });

        it('should handle void return type', () => {
            const code = 'function test(): void {}';
            transform(code);

            const doc = fs.readFileSync(path.join(tempDir, 'api-doc.md'), 'utf-8');
            expect(doc).toContain('Returns: void');
        });
    });

    describe('Error handling', () => {
        it('should throw error when outputDir is missing', () => {
            const code = 'function test() {}';
            expect(() => {
                babel.transformSync(code, {
                    plugins: [[autoDocPlugin, {}]],
                    filename: 'test.ts',
                });
            }).toThrow('outputDir is required');
        });
    });
});
