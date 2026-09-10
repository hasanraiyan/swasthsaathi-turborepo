import * as fs from 'node:fs';
import * as path from 'node:path';
import { Logger } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { AppModule } from './app.module';
import { DomainExceptionFilter } from './common/domain-exception.filter';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  app.setGlobalPrefix('api');
  // Domain errors become HTTP responses here so services never have to know
  // about status codes.
  app.useGlobalFilters(new DomainExceptionFilter());
  app.enableCors({ origin: true });

  const document = createSwaggerDocument(app);

  SwaggerModule.setup('api/docs', app, document, {
    customSiteTitle: 'Swasthya Saathi API Documentation',
    customCss: `
      .swagger-ui .topbar { background-color: #1F4B3F; }
      .swagger-ui .topbar .topbar-wrapper img { content: url('https://res.cloudinary.com/djkpavwmp/image/upload/v1777255297/portfolio_assets/q3kcklesxkonvin1ocpi.png'); height: 40px; }
      .swagger-ui .info .title { color: #1F4B3F; font-family: sans-serif; }
    `,
    swaggerOptions: {
      persistAuthorization: true,
      docExpansion: 'list',
      filter: true,
      showRequestDuration: true,
    },
    jsonDocumentUrl: 'api/docs-json',
    yamlDocumentUrl: 'api/docs-yaml',
  });

  // Export openapi.json to disk if running in development or when requested
  try {
    const docsDir = path.resolve(__dirname, '../../docs');
    if (fs.existsSync(docsDir)) {
      fs.writeFileSync(
        path.join(docsDir, 'openapi.json'),
        JSON.stringify(document, null, 2),
      );
    }
  } catch {
    // Non-fatal if docs directory is not writable
  }

  const port = process.env.PORT ?? 3000;
  await app.listen(port, '0.0.0.0');
  new Logger('Bootstrap').log(`Swasthya Saathi API listening on :${port}/api`);
  new Logger('Bootstrap').log(
    `Swagger Docs available at :${port}/api/docs (JSON: :${port}/api/docs-json)`,
  );
}

void bootstrap();

