import { describe, it, expect, afterEach } from 'vitest';
const babel = require('@babel/core');
const autoI18nPlugin = require('../plugins/auto-i18n-plugin');
const fs = require('fs');
const path = require('path');

describe('autoI18nPlugin', () => {
    const outputDir = path.join(__dirname, './locales');

    const transform = (code, options = {}) => {
        return babel.transformSync(code, {
            plugins: [
                [
                    autoI18nPlugin,
                    {
                        outputDir,
                        moduleSource: 'intl',
                        resetIndex: true,
                        ...options,
                    },
                ],
            ],
            filename: 'test.jsx',
            parserOpts: {
                plugins: ['jsx'],
            },
        });
    };

    afterEach(() => {
        if (fs.existsSync(outputDir)) {
            fs.rmSync(outputDir, { recursive: true });
        }
    });

    describe('StringLiteral', () => {
        it('should transform string literal to intl.t()', () => {
            const code = `const msg = 'hello';`;
            const result = transform(code);

            expect(result.code).toContain(".t('auto_intl_key_0')");
        });

        it('should not transform string in JSX attribute without expression container', () => {
            const code = `<div className="app">hello</div>`;
            const result = transform(code);

            // className="app" should NOT be transformed
            expect(result.code).toContain('className="app"');
            // but JSXText "hello" SHOULD be transformed
            expect(result.code).toContain(".t('auto_intl_key_0')");
        });

        it('should transform string in JSX attribute with expression container', () => {
            const code = `<div title={"hello"}>text</div>`;
            const result = transform(code);

            expect(result.code).toContain(".t('auto_intl_key_0')");
        });
    });

    describe('TemplateLiteral', () => {
        it('should transform template literal with variables', () => {
            const code = `const msg = \`hello \${name}\`;`;
            const result = transform(code);

            expect(result.code).toContain(".t('auto_intl_key_0', name)");
        });

        it('should transform template literal with multiple variables', () => {
            const code = `const msg = \`\${a} and \${b}\`;`;
            const result = transform(code);

            expect(result.code).toContain(".t('auto_intl_key_0', a, b)");
        });

        it('should transform empty template literal (no variables)', () => {
            const code = `const msg = \`hello\`;`;
            const result = transform(code);

            expect(result.code).toContain(".t('auto_intl_key_0')");
        });
    });

    describe('JSXText', () => {
        it('should transform JSX text to intl.t()', () => {
            const code = `<div>hello world</div>`;
            const result = transform(code);

            expect(result.code).toContain(".t('auto_intl_key_0')");
        });

        it('should not transform JSX text inside expression container', () => {
            const code = `<div>{name}</div>`;
            const result = transform(code);

            expect(result.code).not.toContain(".t('");
            expect(result.code).toContain('{name}');
        });
    });

    describe('i18n-disable', () => {
        it('should skip string with i18n-disable comment', () => {
            const code = `const msg = /*i18n-disable*/'hello';`;
            const result = transform(code);

            expect(result.code).toContain("'hello'");
            expect(result.code).not.toContain(".t('");
        });

        it('should skip template literal with i18n-disable comment', () => {
            const code = 'const msg = /*i18n-disable*/`hello`;';
            const result = transform(code);

            expect(result.code).toContain('`hello`');
            expect(result.code).not.toContain(".t('");
        });
    });

    describe('import handling', () => {
        it('should auto inject import if not present', () => {
            const code = `const msg = 'hello';`;
            const result = transform(code);

            expect(result.code).toContain('import');
            expect(result.code).toContain("from 'intl'");
        });

        it('should use existing import if present', () => {
            const code = `import myIntl from 'intl'; const msg = 'hello';`;
            const result = transform(code, { moduleSource: 'intl' });

            expect(result.code).toContain("myIntl.t('auto_intl_key_0')");
            expect(result.code).not.toContain("import intl from 'intl'");
        });
    });

    describe('language file generation', () => {
        it('should generate language file', () => {
            const code = `const msg = 'hello';`;
            transform(code);

            const zhFile = fs.readFileSync(
                path.join(outputDir, 'zh_CN.js'),
                'utf-8'
            );
            const enFile = fs.readFileSync(
                path.join(outputDir, 'en_US.js'),
                'utf-8'
            );

            expect(zhFile).toContain('"auto_intl_key_0": "hello"');
            expect(enFile).toContain('"auto_intl_key_0": "hello"');
        });

        it('should generate correct placeholder format for template literal', () => {
            const code = `const msg = \`\${a} and \${b}\`;`;
            transform(code);

            const zhFile = fs.readFileSync(
                path.join(outputDir, 'zh_CN.js'),
                'utf-8'
            );

            expect(zhFile).toContain('"{0} and {1}"');
        });
    });
});
