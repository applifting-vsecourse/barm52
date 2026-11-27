import { useIntegrationApp } from './app';

describe('quack likes over HTTP and PostgreSQL', () => {
  const { client, signUp, db } = useIntegrationApp();
  const feed = '/api/quacks';
  const likePath = (id: string): string => `${feed}/${id}/like`;
  const repliesPath = (id: string): string => `${feed}/${id}/replies`;
  const noLikes = { count: 0, likedByMe: false };
  const authorAndQuack = async (): Promise<{
    author: Awaited<ReturnType<typeof signUp>>;
    quackId: string;
    authorId: string;
  }> => {
    const author = await signUp('author');
    const { body } = await author
      .post(feed)
      .send({ text: 'Bread by the pond' })
      .expect(201);
    return { author, quackId: body.id, authorId: body.userId };
  };

  it('I1: starts at zero on create and in the feed', async () => {
    const author = await signUp('author');
    const { body: posted } = await author
      .post(feed)
      .send({ text: 'First quack' })
      .expect(201);
    const { body: quacks } = await author.get(feed).expect(200);

    expect([posted.likes, quacks[0].likes]).toEqual([noLikes, noLikes]);
  });

  it('I2: counts self-likes, uses the session, and reads the same totals across lists', async () => {
    const { author, quackId, authorId } = await authorAndQuack();
    const reader = await signUp('reader');
    const path = likePath(quackId);

    // A client-supplied ID must never set whose like this is.
    await reader.put(path).send({ userId: authorId }).expect(200, {
      count: 1,
      likedByMe: true,
    });
    const { body: before } = await author.get(feed).expect(200);
    expect(before[0].likes).toEqual({ count: 1, likedByMe: false });
    await author.put(path).expect(200, { count: 2, likedByMe: true });

    const results = await Promise.all([
      author.get(feed).query({ mine: 'true' }).expect(200),
      reader.get(feed).query({ q: 'bread' }).expect(200),
      reader.get(feed).expect(200),
    ]);
    for (const { body } of results) {
      expect(body[0].likes).toEqual({ count: 2, likedByMe: true });
    }
  });

  it('I3: concurrent likes and repeated unlikes change only this reader’s like', async () => {
    const { author, quackId } = await authorAndQuack();
    const reader = await signUp('reader');
    const path = likePath(quackId);

    const results = await Promise.all([reader.put(path), reader.put(path)]);
    for (const { status, body } of results) {
      expect(status).toBe(200);
      expect(body).toEqual({ count: 1, likedByMe: true });
    }
    await author.put(path).expect(200, { count: 2, likedByMe: true });
    await reader.delete(path).expect(200, { count: 1, likedByMe: false });
    await reader.delete(path).expect(200, { count: 1, likedByMe: false });
    const { body } = await author.get(feed).expect(200);
    expect(body[0].likes).toEqual({ count: 1, likedByMe: true });
  });

  it('I4: requires a real session to read, like or unlike', async () => {
    const { quackId } = await authorAndQuack();
    await client().get(feed).expect(401);
    await client().put(likePath(quackId)).expect(401);
    await client().delete(likePath(quackId)).expect(401);
  });

  it('I5: answers 404 for unknown and deleted quacks and hides the summary', async () => {
    const { author, quackId } = await authorAndQuack();
    await author
      .post(repliesPath(quackId))
      .send({ text: 'Keep me' })
      .expect(201);
    await author.delete(`${feed}/${quackId}`).expect(204);

    for (const id of ['does-not-exist', quackId]) {
      await author.put(likePath(id)).expect(404);
      await author.delete(likePath(id)).expect(404);
    }
    const { body } = await author.get(feed).expect(200);
    expect(body[0]).toMatchObject({ id: quackId, deleted: true, likes: null });
  });

  it('I6: a reply has its own like and count, separate from the parent', async () => {
    const { author, quackId } = await authorAndQuack();
    const reader = await signUp('reader');
    const { body: reply } = await author
      .post(repliesPath(quackId))
      .send({ text: 'A reply' })
      .expect(201);
    const response = await reader.put(likePath(reply.id));
    expect(response.status).toBe(200);
    expect(reply.likes).toEqual(noLikes);
    expect(response.body).toEqual({ count: 1, likedByMe: true });

    const { body: thread } = await reader.get(repliesPath(quackId)).expect(200);
    expect(thread[0].likes).toEqual({ count: 1, likedByMe: true });
    const { body } = await reader.get(feed).expect(200);
    expect(body[0].likes).toEqual(noLikes);
    await reader.delete(likePath(reply.id)).expect(200, noLikes);
  });

  it('I7: clears likes on hard deletes and placeholders while keeping replies', async () => {
    const { author, quackId } = await authorAndQuack();
    const { body: standalone } = await author
      .post(feed)
      .send({ text: 'A solitary quack' })
      .expect(201);
    const { body: reply } = await author
      .post(repliesPath(quackId))
      .send({ text: 'A surviving reply' })
      .expect(201);
    for (const id of [quackId, standalone.id, reply.id]) {
      await author.put(likePath(id)).expect(200, { count: 1, likedByMe: true });
    }

    await author.delete(`${feed}/${standalone.id}`).expect(204);
    await author.delete(`${feed}/${quackId}`).expect(204);
    const { body } = await author.get(repliesPath(quackId)).expect(200);
    expect(body[0]).toMatchObject({
      id: reply.id,
      likes: { count: 1, likedByMe: true },
    });
    const remainingLikes = await db().$queryRaw`
      SELECT "quackId" FROM "quack_like" ORDER BY "quackId"
    `;
    expect(remainingLikes).toEqual([{ quackId: reply.id }]);
    const placeholder = await db().$queryRaw`
      SELECT "likeCount" FROM "quack" WHERE "id" = ${quackId}
    `;
    expect(placeholder).toEqual([{ likeCount: 0 }]);
  });

  it('I8: cascaded deletion of one liker keeps the other like and updates the count', async () => {
    const { author, quackId } = await authorAndQuack();
    const reader = await signUp('reader');
    await author
      .put(likePath(quackId))
      .expect(200, { count: 1, likedByMe: true });
    await reader
      .put(likePath(quackId))
      .expect(200, { count: 2, likedByMe: true });

    await db().user.delete({ where: { username: 'reader' } });
    const { body } = await author.get(feed).expect(200);
    expect(body[0].likes).toEqual({ count: 1, likedByMe: true });
  });
});
