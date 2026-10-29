import { createGameServer } from './server.js';

const port = Number(process.env.SERVER_PORT ?? 3001);
if (!Number.isInteger(port) || port < 1 || port > 65535) throw new Error('SERVER_PORT must be a valid TCP port.');
const allowedOrigins = (process.env.ALLOWED_ORIGIN ?? 'http://127.0.0.1:5173,http://localhost:5173').split(',').map(s => s.trim()).filter(Boolean);
const server = createGameServer({ allowedOrigins });
server.httpServer.listen(port, '127.0.0.1', () => console.log(`Shadow Clash server: http://127.0.0.1:${port}`));
server.httpServer.on('error', error => { console.error(error.message); void server.close().then(() => { process.exitCode = 1; }); });
for (const signal of ['SIGINT', 'SIGTERM'] as const) process.once(signal, () => { void server.close().then(() => { process.exitCode = 0; }); });
