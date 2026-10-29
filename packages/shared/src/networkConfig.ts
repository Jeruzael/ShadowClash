function port(value: string | undefined, fallback: number, name: string): number {
  const number = value?.trim() ? Number(value) : fallback;
  if (!Number.isInteger(number) || number < 1 || number > 65535) throw new Error(`${name} must be a valid TCP port.`);
  return number;
}

// Network configuration is shared by the Node entry point and Vite, never used
// to determine combat. LAN opt-in binds one RFC1918 interface, never a wildcard.
export function resolveNetworkConfig(env: Record<string, string | undefined>) {
  const clientHost = env.LAN_HOST?.trim() || '127.0.0.1';
  if (clientHost !== '127.0.0.1') {
    const parts = clientHost.split('.');
    const octets = parts.map(Number);
    const valid = parts.length === 4 && parts.every((part, index) => /^\d{1,3}$/.test(part) && String(octets[index]) === part && octets[index]! <= 255);
    const privateIp = octets[0] === 10 || (octets[0] === 192 && octets[1] === 168) || (octets[0] === 172 && octets[1]! >= 16 && octets[1]! <= 31);
    if (!valid || !privateIp) throw new Error('LAN_HOST must be this computer\'s private IPv4 address (10.x, 172.16–31.x, or 192.168.x), or empty for loopback.');
  }
  const clientPort = port(env.CLIENT_PORT, 5173, 'CLIENT_PORT');
  const serverPort = port(env.SERVER_PORT, 3001, 'SERVER_PORT');
  const allowedOrigins = env.ALLOWED_ORIGIN?.trim() ? env.ALLOWED_ORIGIN.split(',').map(s => s.trim()).filter(Boolean)
    : [`http://127.0.0.1:${clientPort}`, `http://localhost:${clientPort}`];
  if (clientHost !== '127.0.0.1') allowedOrigins.push(`http://${clientHost}:${clientPort}`);
  const normalizedOrigins = allowedOrigins.map(origin => {
    let url: URL;
    try { url = new URL(origin); } catch { throw new Error('ALLOWED_ORIGIN must contain exact HTTP(S) origins.'); }
    if (!/^https?:\/\/[^/?#]+$/i.test(origin) || url.username || url.password || origin.includes('*')) {
      throw new Error('ALLOWED_ORIGIN must contain exact HTTP(S) origins without paths or wildcards.');
    }
    return url.origin;
  });
  return { clientHost, serverHost: '127.0.0.1', clientPort, serverPort, allowedOrigins: [...new Set(normalizedOrigins)] };
}
