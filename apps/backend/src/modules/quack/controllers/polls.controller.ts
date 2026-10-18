import { PollsService } from '@/modules/quack/services/polls.service';
import { User } from '@/shared/auth/decorators/user.decorator';
import { Identity } from '@/shared/auth/domain/identity';
import { AuthenticatedUserGuard } from '@/shared/auth/guards/authenticated-user.guard';
import {
  Body,
  Controller,
  Delete,
  HttpCode,
  HttpStatus,
  Param,
  Post,
  Put,
  UseGuards,
  UsePipes,
  ValidationPipe,
} from '@nestjs/common';
import {
  ApiCookieAuth,
  ApiOperation,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { SuggestOptionDto, VoteDto } from './dto/poll-requests.dto';
import { PollResponseDto } from './dto/poll.response.dto';

const ENDED = {
  status: 409,
  description:
    'The poll has ended; nothing changed. The body carries reason "poll_ended".',
};

// Everything that changes a poll after it was created. Each answers with the
// poll as the caller sees it afterwards.
@ApiTags('polls')
@Controller('quacks/:quackId/poll')
@UseGuards(AuthenticatedUserGuard)
@ApiCookieAuth()
@UsePipes(
  new ValidationPipe({
    whitelist: true,
    forbidNonWhitelisted: true,
    transform: true,
  }),
)
export class PollsController {
  constructor(private readonly pollsService: PollsService) {}

  @Put('vote')
  @ApiOperation({
    summary: 'Vote, or move your vote to another answer',
    description:
      'Voting for the answer you already chose changes nothing and succeeds.',
  })
  @ApiResponse({ status: 200, type: PollResponseDto })
  @ApiResponse({ status: 401, description: 'Not signed in' })
  @ApiResponse({
    status: 404,
    description:
      'No such quack, no poll on it, or the answer is not a published answer of this poll',
  })
  @ApiResponse(ENDED)
  async vote(
    @User() user: Identity,
    @Param('quackId') quackId: string,
    @Body() body: VoteDto,
  ): Promise<PollResponseDto> {
    return PollResponseDto.fromDomain(
      await this.pollsService.vote(user, quackId, body.optionId),
    );
  }

  @Post('options')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({
    summary: 'Suggest a new answer',
    description:
      "The author's answers, and everybody's when the poll publishes them immediately, can be voted for at once; otherwise they wait for the author.",
  })
  @ApiResponse({ status: 201, type: PollResponseDto })
  @ApiResponse({
    status: 400,
    description:
      'Invalid text, a duplicate, ten answers already, or you already have an answer in this poll',
  })
  @ApiResponse({ status: 401, description: 'Not signed in' })
  @ApiResponse({ status: 403, description: 'The poll takes no new answers' })
  @ApiResponse({ status: 404, description: 'No such quack or no poll on it' })
  @ApiResponse(ENDED)
  async suggestOption(
    @User() user: Identity,
    @Param('quackId') quackId: string,
    @Body() body: SuggestOptionDto,
  ): Promise<PollResponseDto> {
    return PollResponseDto.fromDomain(
      await this.pollsService.suggestOption(user, quackId, body.text),
    );
  }

  @Post('options/:optionId/approve')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Approve a pending suggestion (author only)' })
  @ApiResponse({ status: 200, type: PollResponseDto })
  @ApiResponse({ status: 401, description: 'Not signed in' })
  @ApiResponse({ status: 403, description: 'Not the author of the poll' })
  @ApiResponse({
    status: 404,
    description: 'No such poll, or no such pending suggestion',
  })
  @ApiResponse(ENDED)
  async approve(
    @User() user: Identity,
    @Param('quackId') quackId: string,
    @Param('optionId') optionId: string,
  ): Promise<PollResponseDto> {
    return PollResponseDto.fromDomain(
      await this.pollsService.decideSuggestion(
        user,
        quackId,
        optionId,
        'approve',
      ),
    );
  }

  @Delete('options/:optionId')
  @ApiOperation({
    summary: 'Reject a pending suggestion (author only)',
    description: 'Published answers cannot be deleted.',
  })
  @ApiResponse({ status: 200, type: PollResponseDto })
  @ApiResponse({ status: 401, description: 'Not signed in' })
  @ApiResponse({ status: 403, description: 'Not the author of the poll' })
  @ApiResponse({
    status: 404,
    description: 'No such poll, or no such pending suggestion',
  })
  @ApiResponse(ENDED)
  async reject(
    @User() user: Identity,
    @Param('quackId') quackId: string,
    @Param('optionId') optionId: string,
  ): Promise<PollResponseDto> {
    return PollResponseDto.fromDomain(
      await this.pollsService.decideSuggestion(
        user,
        quackId,
        optionId,
        'reject',
      ),
    );
  }
}
