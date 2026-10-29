import { describe, expect, it } from 'vitest';
import { resolveNetworkConfig } from './networkConfig.js';

describe('local and trusted LAN configuration', () => {
  it('keeps both listeners on loopback unless LAN hosting is explicitly selected', () => {
    expect(resolveNetworkConfig({})).toEqual({ clientHost: '127.0.0.1', serverHost: '127.0.0.1', clientPort: 5173, serverPort: 3001,
      allowedOrigins: ['http://127.0.0.1:5173', 'http://localhost:5173'] });
  });
  it('binds exactly the requested private IPv4 interface and allows its browser origin', () => {
    for (const host of ['192.168.1.25', '10.0.0.5', '172.16.10.2']) {
      expect(resolveNetworkConfig({ LAN_HOST: host })).toMatchObject({ clientHost: host, serverHost: '127.0.0.1', allowedOrigins: expect.arrayContaining([`http://${host}:5173`]) });
    }
  });
  it('uses configured ports for same-origin proxying and preserves explicit origin restrictions', () => {
    expect(resolveNetworkConfig({ LAN_HOST: '192.168.1.25', CLIENT_PORT: '5180', SERVER_PORT: '3100', ALLOWED_ORIGIN: 'http://127.0.0.1:5180' })).toEqual({
      clientHost: '192.168.1.25', serverHost: '127.0.0.1', clientPort: 5180, serverPort: 3100,
      allowedOrigins: ['http://127.0.0.1:5180', 'http://192.168.1.25:5180'],
    });
  });
  it('rejects public, wildcard, multicast, malformed and ambiguous LAN bindings', () => {
    for (const host of ['0.0.0.0', '::', '8.8.8.8', '172.32.1.2', '192.169.0.1', '224.1.2.3', '192.168.999.1', '192.168.01.1', 'example.com']) {
      expect(() => resolveNetworkConfig({ LAN_HOST: host })).toThrow(/LAN_HOST/);
    }
  });
  it('rejects invalid ports before starting either service', () => {
    for (const port of ['0', '-1', '70000', 'abc', '1.5']) {
      expect(() => resolveNetworkConfig({ SERVER_PORT: port })).toThrow(/SERVER_PORT/);
      expect(() => resolveNetworkConfig({ CLIENT_PORT: port })).toThrow(/CLIENT_PORT/);
    }
  });
  it('rejects wildcard or non-origin allowlist entries', () => {
    for (const origin of ['*', 'not-a-url', 'file:///tmp', 'http://localhost:5173/path', 'http://user:pass@localhost:5173']) {
      expect(() => resolveNetworkConfig({ ALLOWED_ORIGIN: origin })).toThrow(/ALLOWED_ORIGIN/);
    }
  });
  it('canonicalizes HTTP port 80 for loopback, LAN and explicit origins', () => {
    expect(resolveNetworkConfig({ CLIENT_PORT: '80' }).allowedOrigins).toEqual(['http://127.0.0.1', 'http://localhost']);
    expect(resolveNetworkConfig({ CLIENT_PORT: '80', LAN_HOST: '192.168.1.25' }).allowedOrigins).toEqual(['http://127.0.0.1', 'http://localhost', 'http://192.168.1.25']);
    expect(resolveNetworkConfig({ ALLOWED_ORIGIN: 'http://localhost:80,http://localhost' }).allowedOrigins).toEqual(['http://localhost']);
  });
});
