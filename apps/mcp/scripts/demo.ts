/**
 * Cliente MCP de prueba: arranca el servidor por stdio, como Claude Desktop, y llama a
 * una herramienta. Uso: pnpm --filter @sintonia/mcp demo [herramienta] [argumentos JSON]
 *   pnpm --filter @sintonia/mcp demo crear_lista '{"tematica":"music","peticion":"para el gimnasio"}'
 */
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';
import { fileURLToPath } from 'node:url';

const [tool = 'listar_tematicas', args = '{}'] = process.argv.slice(2);
const transport = new StdioClientTransport({
  command: process.execPath,
  args: [fileURLToPath(new URL('../src/index.ts', import.meta.url))],
  env: { ...process.env } as Record<string, string>,
  stderr: 'inherit',
});
const client = new Client({ name: 'sintonia-demo', version: '1.0.0' });
await client.connect(transport);

const started = Date.now();
const result = await client.callTool({ name: tool, arguments: JSON.parse(args) }, undefined, {
  timeout: 120_000,
  resetTimeoutOnProgress: true,
  onprogress: (p) => console.error(`  … ${p.message ?? p.progress}`),
});
for (const c of result.content as { type: string; text?: string }[]) if (c.text) console.log(c.text);
console.error(`\n${tool} en ${((Date.now() - started) / 1000).toFixed(1)} s${result.isError ? ' (error)' : ''}`);
await client.close();
