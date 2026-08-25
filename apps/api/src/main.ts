import { Logger } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';

import { AppModule } from './app.module';
import { DomainExceptionFilter } from './common/domain-exception.filter';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  app.setGlobalPrefix('api');
  // Domain errors become HTTP responses here so services never have to know
  // about status codes.
  app.useGlobalFilters(new DomainExceptionFilter());
  app.enableCors({ origin: true });

  const port = process.env.PORT ?? 3000;
  await app.listen(port);
  new Logger('Bootstrap').log(`Swasthya Saathi API listening on :${port}/api`);
}

void bootstrap();
