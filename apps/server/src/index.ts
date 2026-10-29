import { createGameServer } from './server.js';
import { resolveNetworkConfig } from '@shadow-clash/shared';

const config = resolveNetworkConfig(process.env);
const server = createGameServer({ allowedOrigins: config.allowedOrigins });
server.httpServer.listen(config.serverPort, config.serverHost, () => console.log(`Shadow Clash server: http://${config.serverHost}:${config.serverPort}`));
server.httpServer.on('error', error => { console.error(error.message); void server.close().then(() => { process.exitCode = 1; }); });
for (const signal of ['SIGINT', 'SIGTERM'] as const) process.once(signal, () => { void server.close().then(() => { process.exitCode = 0; }); });
