import { describe, it, expect } from 'vitest';
const babel = require('@babel/core');
const fs = require('fs');
const os = require('os');
const path = require('path');

const macroPath = path.resolve(__dirname, '../list-files.macro.js');

const transformFile = (filename) => {
    return babel.transformFileSync(filename, {
        plugins: [['babel-plugin-macros']],
        filename,
    });
};

const withTempDir = (fn) => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'macro-case-'));
    try {
        return fn(dir);
    } finally {
        fs.rmSync(dir, { recursive: true, force: true });
    }
};

const writeSourceFile = (dir, content) => {
    const filename = path.join(dir, 'source.js');
    fs.writeFileSync(filename, content, 'utf8');
    return filename;
};

describe('files.macro', () => {
    it('replaces files("./dir") with an array of filenames', () => {
        withTempDir((dir) => {
            const srcDir = path.join(dir, 'src');
            fs.mkdirSync(srcDir, { recursive: true });
            fs.writeFileSync(path.join(srcDir, 'a.js'), '', 'utf8');
            fs.writeFileSync(path.join(srcDir, 'b.ts'), '', 'utf8');

            const code = `
                const files = require(${JSON.stringify(macroPath)});
                console.log(files('./src'));
            `;
            const filename = writeSourceFile(dir, code);
            const result = transformFile(filename);

            expect(result.code).toContain('"a.js"');
            expect(result.code).toContain('"b.ts"');
            expect(result.code).not.toContain('files(');
        });
    });

    it('throws when argument is not a string literal', () => {
        withTempDir((dir) => {
            const code = `
                const files = require(${JSON.stringify(macroPath)});
                const p = './src';
                console.log(files(p));
            `;
            const filename = writeSourceFile(dir, code);

            expect(() => transformFile(filename)).toThrow(
                'files.macro expects a single string literal path argument.'
            );
        });
    });

    it('throws when directory does not exist', () => {
        withTempDir((dir) => {
            const code = `
                const files = require(${JSON.stringify(macroPath)});
                console.log(files('./missing'));
            `;
            const filename = writeSourceFile(dir, code);

            expect(() => transformFile(filename)).toThrow('files.macro cannot find directory:');
        });
    });

    it('returns a stable, file-only list', () => {
        withTempDir((dir) => {
            const srcDir = path.join(dir, 'src');
            fs.mkdirSync(path.join(srcDir, 'nested'), { recursive: true });
            fs.writeFileSync(path.join(srcDir, 'z.js'), '', 'utf8');
            fs.writeFileSync(path.join(srcDir, 'a.ts'), '', 'utf8');

            const code = `
                const files = require(${JSON.stringify(macroPath)});
                console.log(files('./src'));
            `;
            const filename = writeSourceFile(dir, code);
            const result = transformFile(filename);

            expect(result.code).toContain('["a.ts", "z.js"]');
            expect(result.code).not.toContain('nested');
        });
    });
});
