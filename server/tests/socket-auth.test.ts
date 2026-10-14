import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import http from 'http';
import { AddressInfo } from 'net';
import { io as ClientSocket, Socket as ClientSocketType } from 'socket.io-client';
import { app } from '../src/app.js';
import { setupSocketServer } from '../src/socket/index.js';
import { generateToken } from '../src/lib/jwt.js';

function waitForEvent<T = any>(socket: ClientSocketType, event: string, timeout = 3000): Promise<T> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      reject(new Error(`Timeout waiting for event: ${event}`));
    }, timeout);

    socket.once(event, (data: T) => {
      clearTimeout(timer);
      resolve(data);
    });
  });
}

describe('Socket.io Handshake Authentication Middleware', () => {
  let httpServer: http.Server;
  let serverPort: number;

  beforeAll(async () => {
    httpServer = http.createServer(app);
    setupSocketServer(httpServer);

    await new Promise<void>((resolve) => {
      httpServer.listen(0, () => {
        serverPort = (httpServer.address() as AddressInfo).port;
        resolve();
      });
    });
  });

  afterAll(async () => {
    await new Promise<void>((resolve) => {
      httpServer.close(() => resolve());
    });
  });

  it('authenticates and connects client with valid JWT token', async () => {
    const token = generateToken({
      userId: 'test-user-id-123',
      username: 'alice_socket',
    });

    const client = ClientSocket(`http://localhost:${serverPort}`, {
      auth: { token },
      transports: ['websocket'],
    });

    try {
      await waitForEvent(client, 'connect');
      expect(client.connected).toBe(true);
    } finally {
      client.disconnect();
    }
  });

  it('rejects connection when token is missing', async () => {
    const client = ClientSocket(`http://localhost:${serverPort}`, {
      auth: {},
      transports: ['websocket'],
    });

    try {
      const err = await waitForEvent<Error>(client, 'connect_error');
      expect(err.message).toMatch(/token required/i);
      expect(client.connected).toBe(false);
    } finally {
      client.disconnect();
    }
  });

  it('rejects connection when token is invalid', async () => {
    const client = ClientSocket(`http://localhost:${serverPort}`, {
      auth: { token: 'invalid-jwt-token' },
      transports: ['websocket'],
    });

    try {
      const err = await waitForEvent<Error>(client, 'connect_error');
      expect(err.message).toMatch(/invalid or expired token/i);
      expect(client.connected).toBe(false);
    } finally {
      client.disconnect();
    }
  });
});
