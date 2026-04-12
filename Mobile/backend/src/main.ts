import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { NestExpressApplication } from '@nestjs/platform-express';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
const helmet = require('helmet');
const cors = require('cors');
const compression = require('compression');
import { AppModule } from './app.module';
import { ConfigService } from '@nestjs/config';
import { LoggerService } from './core/logger/logger.service';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  // Security middleware
  app.use(helmet());
  app.use(cors({
    origin: true, // Allow all origins (reflect request origin)
    credentials: true,
  }));
  app.use(compression());

  // Global prefix
  app.setGlobalPrefix('api/v1');

  // Validation
  app.useGlobalPipes(new ValidationPipe({
    whitelist: true,
    transform: true,
    forbidNonWhitelisted: true,
  }));

  // Swagger docs (development only)
  const configService = app.get(ConfigService);
  const isDev = configService.get('NODE_ENV') !== 'production';

  if (isDev) {
    const config = new DocumentBuilder()
      .setTitle('Smart Career API')
      .setDescription('Production AI Architecture for Career Recommendations')
      .setVersion('1.0')
      .addBearerAuth()
      .build();
    const document = SwaggerModule.createDocument(app, config);
    SwaggerModule.setup('api/docs', app, document);
  }

  // Error handling
  app.use((err: any, req: any, res: any, next: any) => {
    const logger = app.get(LoggerService);
    logger.error(`Request failed: ${req.method} ${req.url}`, err.stack);

    const status = err.statusCode || err.status || 500;
    const message = err.message || 'Internal server error';

    res.status(status).json({
      statusCode: status,
      timestamp: new Date().toISOString(),
      path: req.url,
      error: process.env.NODE_ENV === 'production' && status === 500 ? 'Internal server error' : message,
    });
  });

  const port = configService.get('PORT') || 3000;
  await app.listen(port);
  console.log(`🚀 Backend running on port ${port}`);
  console.log(`📚 API docs: http://localhost:${port}/api/docs`);
}

bootstrap();
