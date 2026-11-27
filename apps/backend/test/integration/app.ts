import { AppModule } from '@/app.module';
import { configureHttpApp } from '@/configure-http-app';
import { PrismaService } from '@/core/prisma/prisma.service';
import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';

import request = require('supertest');

export function useIntegrationApp(): {
  client: () => ReturnType<typeof request>;
  signUp: (username: string) => Promise<ReturnType<typeof request.agent>>;
  db: () => PrismaService;
} {
  let app: INestApplication;
  const db = (): PrismaService => app.get(PrismaService);

  beforeAll(async () => {
    const module = await Test.createTestingModule({ imports: [AppModule] })
      .overrideProvider('EmailService')
      .useValue({ sendEmail: async () => undefined })
      .compile();
    app = module.createNestApplication({ logger: false });
    configureHttpApp(app);
    await app.listen(0, '127.0.0.1');
  });

  const clean = async (): Promise<void> => {
    await db()
      .$executeRaw`TRUNCATE TABLE "user", "quack", "verification" CASCADE`;
  };
  beforeEach(clean);
  afterAll(async () => {
    if (!app) return;
    try {
      await clean();
    } finally {
      await app.close();
    }
  });

  return {
    db,
    client: () => request(app.getHttpServer()),
    signUp: async (username) => {
      const agent = request.agent(app.getHttpServer());
      await agent
        .post('/api/auth/sign-up/email')
        .set('Origin', 'http://localhost:3050')
        .send({
          name: username,
          username,
          email: `${username}@example.com`,
          password: 'password123',
        })
        .expect(200);
      return agent;
    },
  };
}
