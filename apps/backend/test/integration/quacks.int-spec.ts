import { useIntegrationApp } from './app';

describe('GET /api/quacks with a real session and database', () => {
  const { client, signUp } = useIntegrationApp();

  it('returns 401 for a visitor', async () => {
    await client().get('/api/quacks').expect(401);
  });

  it('returns 200 and the stored quack for a signed-in user', async () => {
    const agent = await signUp('reader');
    const { body: quack } = await agent
      .post('/api/quacks')
      .send({ text: 'A quack stored in Postgres' })
      .expect(201);

    const { body } = await agent.get('/api/quacks').expect(200);
    expect(body).toEqual([
      expect.objectContaining({
        id: quack.id,
        text: 'A quack stored in Postgres',
      }),
    ]);
  });
});
