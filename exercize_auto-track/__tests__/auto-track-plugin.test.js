import { describe, it, expect } from 'vitest';
const babel = require('@babel/core');
const autoTrackPlugin = require('../plugins/auto-track-plugin');

describe('autoTrackPlugin', () => {
    const transform = (code, options = {}) => {
        return babel.transformSync(code, {
            plugins: [[autoTrackPlugin, options]],
            filename: 'test.js',
        });
    };

    it('should insert tracker call in function declaration', () => {
        const code = 'function a() { console.log("aaa"); }';
        const result = transform(code);

        expect(result.code).toContain('_tracker2()');
        expect(result.code).toContain('console.log("aaa")');
    });

    it('should insert tracker call in arrow function expression', () => {
        const code = 'const a = () => "ccc";';
        const result = transform(code);

        expect(result.code).toContain('_tracker2()');
        expect(result.code).toContain('return');
    });

    it('should insert tracker call in function expression', () => {
        const code = 'const a = function() { console.log("ddd"); };';
        const result = transform(code);

        expect(result.code).toContain('_tracker2()');
    });

    it('should insert tracker call in class method', () => {
        const code = 'class B { bb() { return "bbb"; } }';
        const result = transform(code);

        expect(result.code).toContain('_tracker2()');
        expect(result.code).toContain('return');
    });

    it('should auto import tracker when not present', () => {
        const code = 'function a() { console.log("aaa"); }';
        const result = transform(code);

        expect(result.code).toContain('import');
        expect(result.code).toContain('tracker');
    });

    it('should use existing tracker import', () => {
        const code = `import tracker from 'tracker';
function a() { console.log("aaa"); }`;
        const result = transform(code, { trackerPath: 'tracker' });

        expect(result.code).toContain('tracker()');
    });

    it('should handle multiple functions', () => {
        const code = `function a() { console.log("a"); }
function b() { console.log("b"); }`;
        const result = transform(code);

        const matches = result.code.match(/_tracker2\(\)/g);
        expect(matches).toHaveLength(2);
    });

    it('should handle named import', () => {
        const code = `import { track } from 'tracker';
function a() { console.log("aaa"); }`;
        const result = transform(code, { trackerPath: 'tracker' });

        expect(result.code).toContain('track()');
    });

    it('should handle namespace import', () => {
        const code = `import * as tracker from 'tracker';
function a() { console.log("aaa"); }`;
        const result = transform(code, { trackerPath: 'tracker' });

        expect(result.code).toContain('tracker()');
    });
});
