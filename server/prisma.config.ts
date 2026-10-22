import 'dotenv/config';
import { defineConfig } from 'prisma/config';

// No fallback URL on purpose: commands that touch a database (`migrate deploy`, `migrate resolve`)
// must be told which one through DATABASE_URL. Offline commands (`generate`,
// `migrate diff --from-empty --to-schema`) do not need it.
export default defineConfig({
  schema: 'prisma/schema.prisma',
  migrations: {
    path: 'prisma/migrations',
  },
  datasource: {
    url: process.env.DATABASE_URL,
  },
});
