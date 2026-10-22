// Must stay the first import: loads `.env` into process.env before any other module runs.
import 'dotenv/config';
import { loadConfig, ConfigError } from './config.js';
import { createStorageAdapter } from './lib/storage.js';
import { createServer } from './server.js';
import { createLogger, installProcessHandlers } from './lib/logger.js';

async function bootstrap() {
  const config = loadConfig(process.env);
  const logger = createLogger({ level: config.logLevel });
  installProcessHandlers(process, logger);
  const storage = createStorageAdapter(config.storage);
  const { httpServer } = await createServer({ config, storage, logger });

  httpServer.listen(config.port, () => {
    logger.info({ port: config.port }, 'Server listening');
  });
}

bootstrap().catch((err) => {
  if (err instanceof ConfigError) {
    console.error(err.message);
  } else {
    console.error('Fatal bootstrap error:', err);
  }
  process.exit(1);
});
