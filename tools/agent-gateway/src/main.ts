import { AgentWorker } from './agentWorker.ts';
import { Gateway } from './gateway.ts';
import { gatewayServer } from './server.ts';

const key = process.env['AGENT_GATEWAY_KEY'] ?? '';

if (key === '') {
  console.error('AGENT_GATEWAY_KEY is not set. Add it to the .env at the root of your checkout.');
  process.exit(1);
}

const host = process.env['AGENT_GATEWAY_HOST'] ?? '127.0.0.1';
const port = Number(process.env['AGENT_GATEWAY_PORT'] ?? '8095');

gatewayServer(new Gateway(new AgentWorker()), key).listen(port, host, () => {
  process.stdout.write(`Agent gateway on http://${host}:${port}/v1/messages\n`);
});
