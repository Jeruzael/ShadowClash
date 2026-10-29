import { defineConfig, loadEnv } from 'vite';
import { fileURLToPath } from 'node:url';

export default defineConfig(({ mode }) => {
  const root = fileURLToPath(new URL('../../', import.meta.url));
  const env = { ...loadEnv(mode, root, ''), ...process.env };
  const proxy = { '/socket.io': { target: `http://127.0.0.1:${env.SERVER_PORT || 3001}`, ws: true } };
  return { envDir: root, server: { proxy }, preview: { proxy } };
});
