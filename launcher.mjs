#!/usr/bin/env node
// Node cannot strip .ts files under node_modules; this hook runs the same sources
// using its built-in stripper. Its ExperimentalWarning goes to stderr, not MCP stdout.
import { registerHooks, stripTypeScriptTypes } from 'node:module';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

registerHooks({
  load(url, context, nextLoad) {
    if (!url.startsWith('file:') || !url.endsWith('.ts')) return nextLoad(url, context);
    const source = readFileSync(fileURLToPath(url), 'utf8');
    return { format: 'module', source: stripTypeScriptTypes(source), shortCircuit: true };
  },
});

await import('./src/main.ts');
