import pkg from '../package.json' with { type: 'json' };
import { serveStdio } from '@modelcontextprotocol/server/stdio';
import type { Deps } from './application/usecases/Deps.ts';
import { loadConfig } from './infrastructure/config.ts';
import { IngressoHttpGateway } from './infrastructure/http/IngressoHttpGateway.ts';
import { createServer } from './interface/mcp/server.ts';
import { createTools } from './interface/mcp/tools.ts';

try {
  const config = loadConfig(process.env);
  const deps: Deps = { config, gateway: new IngressoHttpGateway(config) };
  const tools = createTools(deps);

  serveStdio(() => createServer(deps, tools, pkg.version), {
    onerror: error => console.error('MCP stdio error:', error.message),
  });
} catch (error) {
  console.error('Unable to start MCP server:', error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
}
