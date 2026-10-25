import { QuacksService } from '@/modules/quack/services/quacks.service';
import { User } from '@/shared/auth/decorators/user.decorator';
import { Identity } from '@/shared/auth/domain/identity';
import { AuthenticatedUserGuard } from '@/shared/auth/guards/authenticated-user.guard';
import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Post,
  Query,
  UseGuards,
  UsePipes,
  ValidationPipe,
} from '@nestjs/common';
import {
  ApiCookieAuth,
  ApiOperation,
  ApiQuery,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { CreateQuackDto } from './dto/create-quack.dto';
import { QuackResponseDto } from './dto/quack.response.dto';
import { MineQueryPipe } from './pipes/mine-query.pipe';
import { MAX_SEARCH_LENGTH, SearchQueryPipe } from './pipes/search-query.pipe';

@ApiTags('quacks')
@Controller('quacks')
@UseGuards(AuthenticatedUserGuard)
@ApiCookieAuth()
@UsePipes(
  new ValidationPipe({
    whitelist: true,
    forbidNonWhitelisted: true,
    transform: true,
  }),
)
export class QuacksController {
  constructor(private readonly quacksService: QuacksService) {}

  @Get()
  @ApiOperation({ summary: 'List all quacks, or the ones matching a search' })
  @ApiQuery({
    name: 'q',
    required: false,
    description:
      'Words to search for in the quack text and the author name or username. Every word must match somewhere. Leave it out for every quack.',
    example: 'bread critic',
    schema: { type: 'string', maxLength: MAX_SEARCH_LENGTH },
  })
  @ApiQuery({
    name: 'mine',
    required: false,
    description:
      'true for only your own quacks; who you are comes from the session. Leave it out for every quack.',
    schema: { type: 'boolean' },
  })
  @ApiResponse({ status: 200, type: [QuackResponseDto] })
  @ApiResponse({
    status: 400,
    description: `The search is longer than ${MAX_SEARCH_LENGTH} characters, or mine is not true or false`,
  })
  @ApiResponse({ status: 401, description: 'Not signed in' })
  async list(
    @User() user: Identity,
    @Query('q', SearchQueryPipe) q?: string,
    @Query('mine', MineQueryPipe) mine = false,
  ): Promise<QuackResponseDto[]> {
    const quacks = await this.quacksService.getQuacks(user, q, mine);
    const now = new Date();
    return quacks.map((quack) =>
      QuackResponseDto.fromDomain(quack, user.id, now),
    );
  }

  @Post()
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Create a quack, optionally with a poll' })
  @ApiResponse({ status: 201, type: QuackResponseDto })
  @ApiResponse({
    status: 400,
    description: 'Invalid quack or poll; nothing is created',
  })
  @ApiResponse({ status: 401, description: 'Not signed in' })
  async create(
    @User() user: Identity,
    @Body() body: CreateQuackDto,
  ): Promise<QuackResponseDto> {
    const quack = await this.quacksService.createQuack(user, {
      text: body.text,
      mood: body.mood,
      ...(body.poll ? { poll: body.poll } : {}),
    });
    return QuackResponseDto.fromDomain(quack, user.id);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({
    summary: 'Delete one of your own quacks, or any quack as an admin',
    description:
      "Admins moderate: they may delete anybody's quack. Its poll, answers and votes go with it.",
  })
  @ApiResponse({ status: 204, description: 'Deleted' })
  @ApiResponse({ status: 401, description: 'Not signed in' })
  @ApiResponse({
    status: 403,
    description: 'Not your quack, and you are not an admin',
  })
  @ApiResponse({ status: 404, description: 'No such quack' })
  async remove(@User() user: Identity, @Param('id') id: string): Promise<void> {
    await this.quacksService.deleteQuack(user, id);
  }
}
