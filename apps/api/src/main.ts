import { config } from './config.js';
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module.js';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  app.setGlobalPrefix('api');
  app.enableCors({ origin: config.webUrl });
  app.enableShutdownHooks();
  await app.listen(config.apiPort);
  console.log(`API de Sintonía en http://localhost:${config.apiPort}/api`);
}
await bootstrap();
