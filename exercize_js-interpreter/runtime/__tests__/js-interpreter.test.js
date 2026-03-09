import { describe, it, expect, vi } from 'vitest';
const parser = require('@babel/parser');
const Scope = require('../scope');
const createInterpreter = require('../js-interpreter');

function parse(code) {
    return parser.parse(code, {
        sourceType: 'unambiguous',
    });
}

function execute(code, setupScope) {
    const ast = parse(code);
    const interpreter = createInterpreter();
    const globalScope = new Scope();

    const log = vi.fn();
    const error = vi.fn();
    const warn = vi.fn();

    globalScope.set('console', { log, error, warn });

    if (setupScope) {
        setupScope(globalScope);
    }

    interpreter.run(ast.program, globalScope, code, { silent: true });

    return {
        globalScope,
        log,
        error,
        warn,
    };
}

describe('jsInterpreter', () => {
    it('executes variable declarations and function calls in order', () => {
        const { log } = execute(`
            const base = 2;
            function add(a, b) {
                return a + b;
            }
            const result = add(base, 3);
            console.log('result', result);
        `);

        expect(log).toHaveBeenCalledTimes(1);
        expect(log).toHaveBeenCalledWith('result', 5);
    });

    it('supports nested function calls and binary expressions', () => {
        const { log } = execute(`
            function add(a, b) {
                return a + b;
            }
            function calc(x) {
                return x * 3 - 1;
            }
            console.log(calc(add(2, 4)));
        `);

        expect(log).toHaveBeenCalledWith(17);
    });

    it('resolves identifiers through parent scope', () => {
        const { log } = execute(`
            const base = 10;
            function get() {
                return base;
            }
            console.log(get());
        `);

        expect(log).toHaveBeenCalledWith(10);
    });

    it('binds this correctly for member function calls', () => {
        const { log } = execute(
            `
                console.log(tool.getValue(2));
            `,
            (scope) => {
                scope.set('tool', {
                    value: 5,
                    getValue(multiplier) {
                        return this.value * multiplier;
                    },
                });
            }
        );

        expect(log).toHaveBeenCalledWith(10);
    });

    it('supports computed member access in call expressions', () => {
        const { log } = execute(
            `
                console['log'](100);
            `
        );

        expect(log).toHaveBeenCalledWith(100);
    });

    it('supports string concatenation with binary expression', () => {
        const { log } = execute(`
            const name = 'Stan';
            console.log('hello, ' + name);
        `);

        expect(log).toHaveBeenCalledWith('hello, Stan');
    });

    it('supports declaration without initializer as undefined', () => {
        const { log } = execute(`
            let value;
            console.log(value);
        `);

        expect(log).toHaveBeenCalledWith(undefined);
    });

    it('returns undefined when function has no return statement', () => {
        const { log } = execute(`
            function noop() {}
            const result = noop();
            console.log(result);
        `);

        expect(log).toHaveBeenCalledWith(undefined);
    });

    it('supports return statement without argument', () => {
        const { log } = execute(`
            function stop() {
                return;
            }
            console.log(stop());
        `);

        expect(log).toHaveBeenCalledWith(undefined);
    });

    it('allows inner scope to shadow outer variables', () => {
        const { log } = execute(`
            const value = 10;
            function print(value) {
                console.log(value);
            }
            print(5);
            console.log(value);
        `);

        expect(log).toHaveBeenNthCalledWith(1, 5);
        expect(log).toHaveBeenNthCalledWith(2, 10);
    });

    it('throws when referencing an undeclared identifier', () => {
        const code = `
            console.log(notDefined);
        `;

        expect(() => execute(code)).toThrow(/Identifier notDefined is not defined/);
    });

    it('throws when declaring the same identifier twice in one scope', () => {
        const code = `
            const a = 1;
            const a = 2;
        `;

        expect(() => execute(code)).toThrow(/already been declared/);
    });

    it('throws when calling a non-function identifier', () => {
        const code = `
            const count = 1;
            count();
        `;

        expect(() => execute(code)).toThrow(/is not a function/);
    });

    it('throws when calling a non-function member', () => {
        const code = `
            const tool = 'abc';
            tool.length();
        `;

        expect(() => execute(code)).toThrow(/is not a function/);
    });

    it('throws for unsupported syntax nodes', () => {
        const code = `
            const a = 1;
            if (a) {
                console.log(a);
            }
        `;

        expect(() => execute(code)).toThrow(/No interpreter for node type: IfStatement/);
    });

    it('accepts a Program node as execution input', () => {
        const code = `
            console.log(1 + 2);
        `;
        const ast = parse(code);
        const interpreter = createInterpreter();
        const globalScope = new Scope();
        const log = vi.fn();
        globalScope.set('console', { log, error: vi.fn(), warn: vi.fn() });

        interpreter.run(ast.program, globalScope, code, { silent: true });

        expect(log).toHaveBeenCalledWith(3);
    });

    it('accepts a File node as execution input', () => {
        const code = `
            console.log(4 / 2);
        `;
        const ast = parse(code);
        const interpreter = createInterpreter();
        const globalScope = new Scope();
        const log = vi.fn();
        globalScope.set('console', { log, error: vi.fn(), warn: vi.fn() });

        interpreter.run(ast, globalScope, code, { silent: true });

        expect(log).toHaveBeenCalledWith(2);
    });
});

describe('Scope', () => {
    it('reads variables from parent scope chain', () => {
        const parent = new Scope();
        parent.set('a', 1);
        const child = new Scope(parent);

        expect(child.get('a')).toBe(1);
        expect(child.has('a')).toBe(true);
    });

    it('distinguishes has and hasOwn correctly', () => {
        const parent = new Scope();
        parent.set('x', 1);
        const child = new Scope(parent);
        child.set('y', 2);

        expect(child.has('x')).toBe(true);
        expect(child.hasOwn('x')).toBe(false);
        expect(child.hasOwn('y')).toBe(true);
    });

    it('returns undefined for missing variables', () => {
        const scope = new Scope();

        expect(scope.get('missing')).toBe(undefined);
        expect(scope.has('missing')).toBe(false);
    });
});
