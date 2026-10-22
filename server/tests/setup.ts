import { beforeAll, beforeEach, afterAll } from 'vitest';
import { initPrisma, getPrisma, resetDatabase } from '../src/lib/prisma.js';

beforeAll(async () => {
  await initPrisma('memory:');
});

beforeEach(async () => {
  await resetDatabase();
});

afterAll(async () => {
  const prisma = getPrisma();
  await prisma.$disconnect();
});
