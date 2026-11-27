import { INestApplication } from '@nestjs/common';
import { toNodeHandler } from 'better-auth/node';
import * as cookieParser from 'cookie-parser';
import * as express from 'express';
import { BetterAuth } from './shared/auth/providers/better-auth.provider';
import { Config } from './shared/config/config.service';

export function configureHttpApp(app: INestApplication): void {
  const config = app.get(Config);
  app.enableCors({
    origin: [config.backendUrl, config.frontendUrl],
    credentials: true,
  });
  app.use(cookieParser());

  const expressApp = app.getHttpAdapter().getInstance();
  const betterAuth = app.get<BetterAuth>('BetterAuth');
  // Better Auth reads the incoming body itself. Mount it before express.json().
  expressApp.all('/api/auth/*splat', toNodeHandler(betterAuth));
  expressApp.use(express.json());
  app.setGlobalPrefix('api');
}
