#!/usr/bin/env node

import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { IlinksClient } from './client.js';
import { registerAllTools } from './tools/index.js';

export async function runServer() {
  const client = new IlinksClient();
  const server = new McpServer({
    name: 'ilinks-bookmarks',
    version: '1.0.0'
  });

  registerAllTools(server, client);

  const transport = new StdioServerTransport();
  await server.connect(transport);

  // 日志输出到 stderr，切勿输出到 stdout 以免破坏 MCP stdio JSON-RPC 通信
  console.error('[ilinks-mcp] iLinks Bookmark MCP Server running on stdio');
  if (client.hasAuth()) {
    console.error(`[ilinks-mcp] Configured with API base: ${client.apiBase}`);
  } else {
    console.error('[ilinks-mcp] No token initially configured. You can use ilinks_configure_auth tool to configure it.');
  }
}

runServer().catch((error) => {
  console.error('[ilinks-mcp] Fatal error:', error);
  process.exit(1);
});
