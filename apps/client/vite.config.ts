import { defineConfig, loadEnv } from 'vite';
import { fileURLToPath } from 'node:url';
import { resolveNetworkConfig } from '@shadow-clash/shared';

export default defineConfig(({ mode }) => {
  const root = fileURLToPath(new URL('../../', import.meta.url));
  const env = { ...loadEnv(mode, root, ''), ...process.env };
  const config = resolveNetworkConfig(env);
  const proxy = { '/socket.io': { target: `http://${config.serverHost}:${config.serverPort}`, ws: true } };
  const localServer = { host: config.clientHost, port: config.clientPort, strictPort: true, proxy };
  return { envDir: root, server: localServer, preview: localServer,
    build: { rolldownOptions: { input: {
      game: fileURLToPath(new URL('./index.html', import.meta.url)),
      idlePreview: fileURLToPath(new URL('./asset-preview.html', import.meta.url)),
    } } } };
});
