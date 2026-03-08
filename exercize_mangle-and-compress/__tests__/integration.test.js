import { describe, it, expect } from 'vitest';
import transform from './transform.helper';
const manglePlugin = require('../plugins/mangle-plugin');
const compressPlugin = require('../plugins/compress-plugin');

describe('compressAndMangleIntegration', () => {
    it('should compress and mangle together', () => {
        const input = `
            function func() {
                const num1 = 1;
                const num2 = 2;
                const num3 = /*@__PURE__*/add(1, 2);
                const num4 = add(3, 4);
                console.log(num2);
                return num2;
                console.log(num1);
                function add(aaa, bbb) {
                    return aaa + bbb;
                }
            }
            func();
        `;

        const output = transform(input, [compressPlugin, manglePlugin]);

        expect(output).not.toContain('num1'); // unused variable
        expect(output).not.toContain('num3'); // PURE call
        expect(output).not.toContain('const num2 = 2'); // should be inlined
        expect(output).toContain('console.log(2)'); // inlined literal

        expect(output).toMatch(/function _\w+\(\)/); // mangled function name
    });

    it('should produce executable code', () => {
        const input = `
            function add(a, b) {
                return a + b;
            }
            console.log(add(1, 2));
        `;

        const output = transform(input, [manglePlugin, compressPlugin]);

        expect(() => eval(output)).not.toThrow();
    });
});
