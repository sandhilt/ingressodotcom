import { Client, InMemoryTransport } from '@modelcontextprotocol/client';
import type { ContentGateway } from '../../src/application/ports/ContentGateway.ts';
import { createServer } from '../../src/interface/mcp/server.ts';

export async function connect(gateway: ContentGateway) {
  const server = createServer({ gateway, config: { partnership: 'configured' } });
  const client = new Client({ name: 'interface-test', version: '1.0.0' });
  const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();
  try {
    await server.connect(serverTransport);
    await client.connect(clientTransport);
  } catch (error) {
    await client.close();
    await server.close();
    throw error;
  }
  return {
    client,
    async close() {
      try {
        await client.close();
      } finally {
        await server.close();
      }
    },
  };
}

