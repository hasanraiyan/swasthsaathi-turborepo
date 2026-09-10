import * as fs from 'node:fs';
import * as path from 'node:path';
import { NestFactory } from '@nestjs/core';
import { AppModule } from '../src/app.module';
import { createSwaggerDocument } from '../src/swagger.config';

async function generate() {
  const app = await NestFactory.create(AppModule, { logger: false });
  app.setGlobalPrefix('api');

  const document = createSwaggerDocument(app);

  const docsDir = path.resolve(__dirname, '../../../docs');
  fs.mkdirSync(docsDir, { recursive: true });
  const openApiPath = path.join(docsDir, 'openapi.json');
  fs.writeFileSync(openApiPath, JSON.stringify(document, null, 2));

  console.log(`OpenAPI document generated at: ${openApiPath}`);

  // Also copy to packages/sdk/openapi.json if packages/sdk exists
  const sdkDir = path.resolve(__dirname, '../../../packages/sdk');
  if (fs.existsSync(sdkDir)) {
    fs.writeFileSync(
      path.join(sdkDir, 'openapi.json'),
      JSON.stringify(document, null, 2),
    );
    console.log(`Copied OpenAPI document to: ${path.join(sdkDir, 'openapi.json')}`);
  }

  await app.close();
  process.exit(0);
}

void generate();
