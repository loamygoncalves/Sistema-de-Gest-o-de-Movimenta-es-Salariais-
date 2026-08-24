import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import { ConfigService } from '@nestjs/config';
import { ValidationPipe } from '@nestjs/common';
import helmet from 'helmet';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { AppModule } from './app.module';
import { HttpExceptionFilter } from './common/filters/http-exception.filter';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  const configService = app.get(ConfigService);

  app.use(helmet());
  app.enableCors({ origin: configService.get<string>('corsOrigin'), credentials: true });
  app.setGlobalPrefix(configService.get<string>('apiPrefix')!);
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      transform: true,
      forbidNonWhitelisted: false,
    }),
  );
  app.useGlobalFilters(new HttpExceptionFilter());

  const swaggerConfig = new DocumentBuilder()
    .setTitle('Sistema de Gestão de Movimentações Salariais')
    .setDescription(
      'API de controle orçamentário de pessoal, movimentações salariais, ' +
        'simulador de impacto financeiro, workflow de aprovação e estudos salariais.',
    )
    .setVersion('1.0')
    .addBearerAuth()
    .build();
  const document = SwaggerModule.createDocument(app, swaggerConfig);
  SwaggerModule.setup('docs', app, document);

  const port = configService.get<number>('port')!;
  await app.listen(port);
  // eslint-disable-next-line no-console
  console.log(`API rodando em http://localhost:${port}/${configService.get('apiPrefix')}`);
  // eslint-disable-next-line no-console
  console.log(`Documentação Swagger em http://localhost:${port}/docs`);
}

bootstrap();
