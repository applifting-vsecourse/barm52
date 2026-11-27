import { QuacksService } from '@/modules/quack/services/quacks.service';
import { User } from '@/shared/auth/decorators/user.decorator';
import { Identity } from '@/shared/auth/domain/identity';
import { AuthenticatedUserGuard } from '@/shared/auth/guards/authenticated-user.guard';
import { Controller, Delete, Param, Put, UseGuards } from '@nestjs/common';
import {
  ApiCookieAuth,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import { LikeSummaryDto } from './dto/like-summary.dto';

@ApiTags('quacks')
@Controller('quacks/:id/like')
@UseGuards(AuthenticatedUserGuard)
@ApiCookieAuth()
@ApiOkResponse({ type: LikeSummaryDto })
@ApiNotFoundResponse({ description: 'No such quack, or it was deleted' })
@ApiUnauthorizedResponse({ description: 'Not signed in' })
export class LikesController {
  constructor(private readonly quacksService: QuacksService) {}

  @Put()
  @ApiOperation({ summary: 'Like a quack or reply' })
  like(
    @User() user: Identity,
    @Param('id') id: string,
  ): Promise<LikeSummaryDto> {
    return this.quacksService.setLike(user, id, true);
  }

  @Delete()
  @ApiOperation({ summary: 'Remove your like from a quack or reply' })
  unlike(
    @User() user: Identity,
    @Param('id') id: string,
  ): Promise<LikeSummaryDto> {
    return this.quacksService.setLike(user, id, false);
  }
}
