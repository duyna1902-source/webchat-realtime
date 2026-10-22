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

/**
 * Connects Prisma to `databaseUrl` (from the validated config). `memory:` starts an in-memory
 * PGlite database loaded with `prisma/schema.sql`; the config only allows it under NODE_ENV=test.
 */
export async function initPrisma(databaseUrl: string): Promise<PrismaClient> {
  if (prismaInstance) return prismaInstance;

  if (databaseUrl.startsWith('memory:')) {
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
  const pool = new Pool({ connectionString: databaseUrl });
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
