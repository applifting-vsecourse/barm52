import { Mood, Quack } from '@/modules/quack/domain/quack';
import { searchWords } from '@/modules/quack/domain/search-words';
import { QuackRepository } from '@/modules/quack/repositories/quack.repository';
import { Identity } from '@/shared/auth/domain/identity';
import { Injectable, Logger } from '@nestjs/common';

@Injectable()
export class QuacksService {
  private readonly logger = new Logger(QuacksService.name);

  constructor(private readonly quackRepository: QuackRepository) {}

  async getQuacks(user: Identity, query?: string): Promise<Quack[]> {
    const words = searchWords(query);
    if (words.length > 0) {
      // The one record of search use: who searched and when, never what they
      // typed. Product measures distinct users per day from these lines, so
      // keep the event name and the shape stable. It is written before the
      // lookup, so a search that finds nothing, or fails, still counts.
      this.logger.log(
        `quack_search user=${user.id} at=${new Date().toISOString()}`,
      );
    }
    return this.quackRepository.getQuacks(words);
  }

  async createQuack(
    user: Identity,
    quackData: { text: string; mood?: Mood | null },
  ): Promise<Quack> {
    return this.quackRepository.createQuack({
      text: quackData.text,
      // a quack without a mood is stored as null, whether the field was left
      // out or sent as null
      mood: quackData.mood ?? null,
      // the author is taken from the session, never from the request body
      userId: user.id,
    });
  }
}
