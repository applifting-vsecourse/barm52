import { PollView, toPollView } from '@/modules/quack/domain/poll';
import { PollRepository } from '@/modules/quack/repositories/poll.repository';
import { Identity } from '@/shared/auth/domain/identity';
import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';

export const POLL_ENDED_REASON = 'poll_ended';

// The client tells "the poll has ended" apart from other conflicts by `reason`.
const pollEnded = (): ConflictException =>
  new ConflictException({
    statusCode: 409,
    error: 'Conflict',
    message: 'This poll has ended.',
    reason: POLL_ENDED_REASON,
  });

const pollNotFound = (): NotFoundException =>
  new NotFoundException('Poll not found');

@Injectable()
export class PollsService {
  private readonly logger = new Logger(PollsService.name);

  constructor(private readonly pollRepository: PollRepository) {}

  async getPoll(user: Identity, quackId: string): Promise<PollView> {
    const poll = await this.pollRepository.getPoll(quackId, user.id);
    if (!poll) throw pollNotFound();
    return toPollView(poll, user.id, new Date());
  }

  // Answers with the poll as it is after the vote, other people's votes
  // included.
  async vote(
    user: Identity,
    quackId: string,
    optionId: string,
  ): Promise<PollView> {
    const outcome = await this.pollRepository.castVote({
      quackId,
      userId: user.id,
      optionId,
      now: new Date(),
    });
    if (outcome === 'not_found') {
      throw new NotFoundException('Poll option not found');
    }
    if (outcome === 'ended') throw pollEnded();
    if (outcome === 'changed') {
      // Who voted in which poll and when, never which answer nor any text.
      // Product counts distinct users per day; keep the shape stable. A click
      // on the answer already chosen changes nothing and is not a vote.
      this.logger.log(this.usageLine('poll_vote', user, quackId));
    }
    return this.getPoll(user, quackId);
  }

  async suggestOption(
    user: Identity,
    quackId: string,
    text: string,
  ): Promise<PollView> {
    const outcome = await this.pollRepository.suggestOption({
      quackId,
      userId: user.id,
      text,
      now: new Date(),
    });
    switch (outcome) {
      case 'not_found':
        throw pollNotFound();
      case 'not_allowed':
        throw new ForbiddenException('This poll does not take new answers');
      case 'ended':
        throw pollEnded();
      case 'full':
        throw new BadRequestException(
          'This poll already has the maximum number of options',
        );
      case 'duplicate':
        throw new BadRequestException('Answers must be different');
      case 'limit_reached':
        throw new BadRequestException(
          'You already have an answer in this poll',
        );
      case 'added_by_other':
        // Only suggestions from others count; the author adding an answer is
        // not what product wants to measure.
        this.logger.log(this.usageLine('poll_option_suggested', user, quackId));
        break;
      case 'added_by_author':
        break;
    }
    return this.getPoll(user, quackId);
  }

  async decideSuggestion(
    user: Identity,
    quackId: string,
    optionId: string,
    decision: 'approve' | 'reject',
  ): Promise<PollView> {
    const outcome = await this.pollRepository.decideSuggestion({
      quackId,
      optionId,
      userId: user.id,
      decision,
      now: new Date(),
    });
    switch (outcome) {
      case 'not_found':
        throw pollNotFound();
      case 'forbidden':
        throw new ForbiddenException(
          'Only the author of the poll can decide on suggestions',
        );
      case 'ended':
        throw pollEnded();
      case 'suggestion_not_found':
        throw new NotFoundException('Suggestion not found');
      case 'done':
        break;
    }
    return this.getPoll(user, quackId);
  }

  private usageLine(event: string, user: Identity, quackId: string): string {
    return `${event} user=${user.id} poll=${quackId} at=${new Date().toISOString()}`;
  }
}
