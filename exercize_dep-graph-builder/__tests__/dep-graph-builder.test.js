import { describe, it, expect, beforeEach } from 'vitest';
import fs from 'fs';
import path from 'path';
import os from 'os';
const buildDependencyGraph = require('../dep-graph-builder/dep-graph-builder');

const writeFile = (filePath, content) => {
    fs.mkdirSync(path.dirname(filePath), { recursive: true });
    fs.writeFileSync(filePath, content);
};

const createFixture = () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'dep-graph-'));

    writeFile(
        path.join(root, 'index.js'),
        `
            import './side-effect';
            import { aa1, aa2 } from './a';
            import bbDefault from './b';
            import { cc } from './c';
            import React from 'react';
            console.log(aa1, aa2, bbDefault, cc, React);
        `
    );

    writeFile(
        path.join(root, 'side-effect.js'),
        `
            console.log('side effect');
        `
    );

    writeFile(
        path.join(root, 'a.js'),
        `
            import { cc as renamedCc } from './c';
            export const aa1 = 1;
            export const aa2 = renamedCc;
        `
    );

    writeFile(
        path.join(root, 'b.js'),
        `
            import { cc } from './c';
            const b = cc + 1;
            export default b;
            export { b as bb };
        `
    );

    writeFile(
        path.join(root, 'c/index.js'),
        `
            const cc = 5;
            export { cc };
        `
    );

    return root;
};

describe('dep-graph-builder', () => {
    let fixtureRoot;

    beforeEach(() => {
        fixtureRoot = createFixture();
    });

    it('builds a dependency graph with root imports', () => {
        const graph = buildDependencyGraph(path.join(fixtureRoot, 'index.js'));
        const rootImports = Object.keys(graph.root.imports).map((p) => path.basename(p));

        expect(rootImports).toContain('a.js');
        expect(rootImports).toContain('b.js');
        expect(rootImports).toContain('index.js'); // c/index.js
        expect(rootImports).toContain('side-effect.js');
    });

    it('records side-effect-only imports', () => {
        const graph = buildDependencyGraph(path.join(fixtureRoot, 'index.js'));
        const sideEffectEntry = Object.entries(graph.root.imports).find(([dep]) =>
            dep.endsWith('side-effect.js')
        );

        expect(sideEffectEntry).toBeTruthy();
        expect(sideEffectEntry[1][0].type).toBe('side-effect');
    });

    it('ignores bare module imports', () => {
        const graph = buildDependencyGraph(path.join(fixtureRoot, 'index.js'));
        const importKeys = Object.keys(graph.root.imports);

        expect(importKeys.some((p) => p.includes('node_modules'))).toBe(false);
        expect(importKeys.some((p) => p.endsWith('react'))).toBe(false);
    });

    it('records named and default exports correctly', () => {
        const graph = buildDependencyGraph(path.join(fixtureRoot, 'index.js'));
        const aPath = Object.keys(graph.allModules).find((p) => p.endsWith('a.js'));
        const bPath = Object.keys(graph.allModules).find((p) => p.endsWith('b.js'));

        const aExports = graph.allModules[aPath].exports.map((e) => e.exportedName);
        const bExports = graph.allModules[bPath].exports.map((e) => e.type);

        expect(aExports).toContain('aa1');
        expect(aExports).toContain('aa2');
        expect(bExports).toContain('default');
        expect(bExports).toContain('named');
    });

    it('creates subModules for child dependencies', () => {
        const graph = buildDependencyGraph(path.join(fixtureRoot, 'index.js'));
        const aPath = Object.keys(graph.root.subModules).find((p) => p.endsWith('a.js'));

        expect(aPath).toBeTruthy();
        expect(Object.keys(graph.root.subModules[aPath].subModules).length).toBeGreaterThan(0);
    });

    it('resolves extensionless and index imports', () => {
        const root = fs.mkdtempSync(path.join(os.tmpdir(), 'dep-graph-'));

        writeFile(
            path.join(root, 'index.js'),
            `
                import util from './util';
                import { foo } from './dir';
                console.log(util, foo);
            `
        );
        writeFile(path.join(root, 'util.js'), `export default 1;`);
        writeFile(path.join(root, 'dir/index.js'), `export const foo = 2;`);

        const graph = buildDependencyGraph(path.join(root, 'index.js'));
        const importKeys = Object.keys(graph.root.imports).map((p) => path.basename(p));

        expect(importKeys).toContain('util.js');
        expect(importKeys).toContain('index.js');
    });

    it('records namespace imports', () => {
        const root = fs.mkdtempSync(path.join(os.tmpdir(), 'dep-graph-'));

        writeFile(
            path.join(root, 'index.js'),
            `
                import * as utils from './utils';
                console.log(utils);
            `
        );
        writeFile(path.join(root, 'utils.js'), `export const a = 1;`);

        const graph = buildDependencyGraph(path.join(root, 'index.js'));
        const entry = Object.values(graph.root.imports)[0][0];

        expect(entry.type).toBe('namespace');
        expect(entry.localName).toBe('utils');
    });

    it('records export-all declarations', () => {
        const root = fs.mkdtempSync(path.join(os.tmpdir(), 'dep-graph-'));

        writeFile(
            path.join(root, 'index.js'),
            `
                export * from './lib';
            `
        );
        writeFile(path.join(root, 'lib.js'), `export const a = 1;`);

        const graph = buildDependencyGraph(path.join(root, 'index.js'));
        const exportTypes = graph.root.exports.map((e) => e.type);

        expect(exportTypes).toContain('all');
    });

    it('creates dependency edges for export-all re-exports', () => {
        const root = fs.mkdtempSync(path.join(os.tmpdir(), 'dep-graph-'));

        writeFile(
            path.join(root, 'index.js'),
            `
                export * from './lib';
            `
        );
        writeFile(path.join(root, 'lib.js'), `export const a = 1;`);

        const graph = buildDependencyGraph(path.join(root, 'index.js'));
        const subModuleKeys = Object.keys(graph.root.subModules);

        expect(subModuleKeys.some((p) => p.endsWith('lib.js'))).toBe(true);
    });

    it('creates dependency edges for named re-exports', () => {
        const root = fs.mkdtempSync(path.join(os.tmpdir(), 'dep-graph-'));

        writeFile(
            path.join(root, 'index.js'),
            `
                export { foo as bar } from './lib';
            `
        );
        writeFile(path.join(root, 'lib.js'), `export const foo = 1;`);

        const graph = buildDependencyGraph(path.join(root, 'index.js'));
        const subModuleKeys = Object.keys(graph.root.subModules);
        const exported = graph.root.exports.find((item) => item.exportedName === 'bar');

        expect(subModuleKeys.some((p) => p.endsWith('lib.js'))).toBe(true);
        expect(exported?.source).toBe('./lib');
    });

    it('handles circular dependencies without crashing', () => {
        const root = fs.mkdtempSync(path.join(os.tmpdir(), 'dep-graph-'));

        writeFile(
            path.join(root, 'index.js'),
            `
                import './a';
            `
        );
        writeFile(
            path.join(root, 'a.js'),
            `
                import './b';
                export const a = 1;
            `
        );
        writeFile(
            path.join(root, 'b.js'),
            `
                import './a';
                export const b = 2;
            `
        );

        const graph = buildDependencyGraph(path.join(root, 'index.js'));
        const aPath = Object.keys(graph.allModules).find((p) => p.endsWith('a.js'));
        const bPath = Object.keys(graph.allModules).find((p) => p.endsWith('b.js'));

        expect(aPath).toBeTruthy();
        expect(bPath).toBeTruthy();
    });
});
