import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { PrismaClient } from '@prisma/client';
import { PGlite } from '@electric-sql/pglite';
import { PrismaPGlite } from 'pglite-prisma-adapter';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

let prismaInstance: PrismaClient | null = null;
let pgliteInstance: PGlite | null = null;

export async function initPrisma(): Promise<PrismaClient> {
  if (prismaInstance) return prismaInstance;

  const isTest = process.env.NODE_ENV === 'test';
  const hasExternalDb = process.env.DATABASE_URL && !process.env.DATABASE_URL.startsWith('memory:');

  if (isTest || !hasExternalDb) {
    if (!pgliteInstance) {
      pgliteInstance = new PGlite();
      // Load DDL schema
      const schemaSqlPath = path.resolve(__dirname, '../../prisma/schema.sql');
      if (fs.existsSync(schemaSqlPath)) {
        const ddl = fs.readFileSync(schemaSqlPath, 'utf-8');
        await pgliteInstance.exec(ddl);
      }
    }
    const adapter = new PrismaPGlite(pgliteInstance);
    prismaInstance = new PrismaClient({ adapter });
    return prismaInstance;
  }

  // Production or external database connection
  // In Prisma 7, adapter-pg can be used for standard Postgres pool
  const { Pool } = await import('pg');
  const { PrismaPg } = await import('@prisma/adapter-pg');
  const pool = new Pool({ connectionString: process.env.DATABASE_URL });
  const adapter = new PrismaPg(pool);
  prismaInstance = new PrismaClient({ adapter });
  return prismaInstance;
}

export function getPrisma(): PrismaClient {
  if (!prismaInstance) {
    throw new Error('Prisma has not been initialized. Call initPrisma() first.');
  }
  return prismaInstance;
}

export function getPglite(): PGlite | null {
  return pgliteInstance;
}

export async function resetDatabase(): Promise<void> {
  if (pgliteInstance) {
    // Truncate all tables
    await pgliteInstance.exec(`
      TRUNCATE TABLE 
        "RoomMessage", 
        "RoomMember", 
        "Room", 
        "DirectMessage", 
        "DirectChatParticipant", 
        "DirectChat", 
        "User" 
      CASCADE;
    `);
  } else if (prismaInstance) {
    await prismaInstance.$executeRawUnsafe(`
      TRUNCATE TABLE 
        "RoomMessage", 
        "RoomMember", 
        "Room", 
        "DirectMessage", 
        "DirectChatParticipant", 
        "DirectChat", 
        "User" 
      CASCADE;
    `);
  }
}
