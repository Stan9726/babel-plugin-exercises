import { describe, it, expect } from 'vitest';
const babel = require('@babel/core');
const paramInsertPlugin = require('../plugins/param-insert-plugin');

describe('paramInsertPlugin', () => {
    const transform = (code, filename = 'test.js') => {
        return babel.transformSync(code, {
            plugins: [paramInsertPlugin],
            filename,
        });
    };

    it('should insert filename and line info before console.log', () => {
        const code = 'console.log("hello")';
        const result = transform(code);
        
        expect(result.code).toContain('console.log');
        expect(result.code).toContain('filename:');
        expect(result.code).toContain('test.js');
    });

    it('should insert info before console.info', () => {
        const code = 'console.info("info message")';
        const result = transform(code);
        
        expect(result.code).toContain('console.log');
        expect(result.code).toContain('info message');
    });

    it('should insert info before console.error', () => {
        const code = 'console.error("error message")';
        const result = transform(code);
        
        expect(result.code).toContain('console.log');
        expect(result.code).toContain('error message');
    });

    it('should insert info before console.debug', () => {
        const code = 'console.debug("debug message")';
        const result = transform(code);
        
        expect(result.code).toContain('console.log');
        expect(result.code).toContain('debug message');
    });

    it('should not transform non-console calls', () => {
        const code = 'myFunction("test")';
        const result = transform(code);
        
        expect(result.code).toBe('myFunction("test");');
    });

    it('should handle multiple console calls', () => {
        const code = 'console.log("a"); console.log("b");';
        const result = transform(code);
        
        const matches = result.code.match(/console\.log/g);
        expect(matches).toHaveLength(4);
    });
});
