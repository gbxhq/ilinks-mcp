import { spawn } from 'child_process';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const serverScript = path.resolve(__dirname, '../src/index.js');

const proc = spawn('node', [serverScript], {
  env: {
    ...process.env,
    ILINKS_API_BASE: 'https://ilinks.fun',
    ILINKS_TOKEN: 'mock-test-token'
  },
  stdio: ['pipe', 'pipe', 'inherit']
});

let output = '';
proc.stdout.on('data', (data) => {
  output += data.toString();
  try {
    const lines = output.trim().split('\n');
    for (const line of lines) {
      if (!line.trim()) continue;
      const json = JSON.parse(line);
      if (json.id === 1) {
        console.log('✅ Received initialization response from MCP server:');
        console.log(JSON.stringify(json.result, null, 2));

        // Send tools/list request
        const listToolsRequest = {
          jsonrpc: '2.0',
          id: 2,
          method: 'tools/list',
          params: {}
        };
        proc.stdin.write(JSON.stringify(listToolsRequest) + '\n');
      } else if (json.id === 2) {
        console.log(`✅ Received tools/list response: ${json.result.tools.length} tools registered.`);
        json.result.tools.forEach(t => console.log(`   - ${t.name}: ${t.description.slice(0, 40)}...`));
        proc.kill();
        process.exit(0);
      }
    }
  } catch (e) {
    // wait for more data
  }
});

const initRequest = {
  jsonrpc: '2.0',
  id: 1,
  method: 'initialize',
  params: {
    protocolVersion: '2024-11-05',
    capabilities: {},
    clientInfo: { name: 'test-client', version: '1.0.0' }
  }
};

proc.stdin.write(JSON.stringify(initRequest) + '\n');

setTimeout(() => {
  console.error('Timeout waiting for response');
  proc.kill();
  process.exit(1);
}, 5000);
