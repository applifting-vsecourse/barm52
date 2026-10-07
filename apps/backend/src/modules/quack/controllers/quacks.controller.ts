import { QuacksService } from '@/modules/quack/services/quacks.service';
import { User } from '@/shared/auth/decorators/user.decorator';
import { Identity } from '@/shared/auth/domain/identity';
import { AuthenticatedUserGuard } from '@/shared/auth/guards/authenticated-user.guard';
import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
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
  @ApiResponse({ status: 200, type: [QuackResponseDto] })
  @ApiResponse({
    status: 400,
    description: `The search is longer than ${MAX_SEARCH_LENGTH} characters`,
  })
  @ApiResponse({ status: 401, description: 'Not signed in' })
  async list(
    @User() user: Identity,
    @Query('q', SearchQueryPipe) q?: string,
  ): Promise<QuackResponseDto[]> {
    const quacks = await this.quacksService.getQuacks(user, q);
    return quacks.map(QuackResponseDto.fromDomain);
  }

  @Post()
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Create a quack' })
  @ApiResponse({ status: 201, type: QuackResponseDto })
  @ApiResponse({ status: 401, description: 'Not signed in' })
  async create(
    @User() user: Identity,
    @Body() body: CreateQuackDto,
  ): Promise<QuackResponseDto> {
    const quack = await this.quacksService.createQuack(user, {
      text: body.text,
      mood: body.mood,
    });
    return QuackResponseDto.fromDomain(quack);
  }
}
