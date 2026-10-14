import http from 'http';
import dotenv from 'dotenv';
import { app } from './app.js';
import { setupSocketServer } from './socket/index.js';
import { initPrisma } from './lib/prisma.js';

dotenv.config();

const PORT = process.env.PORT || 4000;

async function bootstrap() {
  await initPrisma();

  const httpServer = http.createServer(app);
  setupSocketServer(httpServer);

  httpServer.listen(PORT, () => {
    console.log(`🚀 Server listening on http://localhost:${PORT}`);
  });
}

bootstrap().catch((err) => {
  console.error('Fatal bootstrap error:', err);
  process.exit(1);
});
