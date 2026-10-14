import { beforeAll, beforeEach, afterAll } from 'vitest';
import { initPrisma, getPrisma, resetDatabase } from '../src/lib/prisma.js';

beforeAll(async () => {
  process.env.NODE_ENV = 'test';
  process.env.JWT_SECRET = 'test-jwt-secret-key-at-least-32-chars-long';
  await initPrisma();
});

beforeEach(async () => {
  await resetDatabase();
});

afterAll(async () => {
  const prisma = getPrisma();
  await prisma.$disconnect();
});
