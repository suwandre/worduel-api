import {
  Controller,
  Post,
  Get,
  Body,
  Param,
  UseGuards,
  Patch,
  Query,
} from '@nestjs/common';
import { GamesService } from './games.service';
import { CreateGameDto } from './dto/create-game.dto';
import { SubmitGuessDto } from './dto/submit-guess.dto';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { CurrentUser, type JwtUser } from '../common/decorators/user.decorator';
import { CreateInviteDto } from './dto/create-invite.dto';
import { RespondInviteDto } from './dto/respond-invite.dto';
import { AuthGuard } from '@nestjs/passport';

@Controller('games')
@UseGuards(JwtAuthGuard)
export class GamesController {
  constructor(private gamesService: GamesService) {}

  @Post()
  create(
    @Body() createGameDto: CreateGameDto,
    @CurrentUser() user: { userId: string; email: string },
  ) {
    return this.gamesService.create(user.userId, createGameDto);
  }

  @Get('word-options')
  getWordOptions(@Query('count') count?: string) {
    const numCount = count ? parseInt(count, 10) : 4;
    return this.gamesService.getRandomWords(numCount);
  }

  @Get()
  findUserGames(@CurrentUser() user: { userId: string; email: string }) {
    return this.gamesService.findUserGames(user.userId);
  }

  @Post(':id/guess')
  submitGuess(
    @Param('id') id: string,
    @Body() submitGuessDto: SubmitGuessDto,
    @CurrentUser() user: { userId: string; email: string },
  ) {
    return this.gamesService.submitGuess(id, user.userId, submitGuessDto.guess);
  }

  @Patch(':id/word')
  setWord(
    @Param('id') id: string,
    @Body() body: { targetWord: string },
    @CurrentUser() user: JwtUser,
  ) {
    return this.gamesService.setGameWord(id, user.userId, body.targetWord);
  }

  @Post('invites')
  createInvite(
    @Body() createInviteDto: CreateInviteDto,
    @CurrentUser() user: JwtUser,
  ) {
    return this.gamesService.createInvite(user.userId, createInviteDto);
  }

  @Get('invites/me')
  getMyInvites(@CurrentUser() user: JwtUser) {
    return this.gamesService.getUserInvites(user.userId);
  }

  @Post('invites/:id/respond')
  respondToInvite(
    @Param('id') id: string,
    @Body() respondInviteDto: RespondInviteDto,
    @CurrentUser() user: JwtUser,
  ) {
    return this.gamesService.respondToInvite(
      id,
      user.userId,
      respondInviteDto.accept,
    );
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.gamesService.findById(id);
  }

  @Post(':id/set-word')
  @UseGuards(AuthGuard)
  setRoundWord(
    @Param('id') id: string,
    @Body() body: { word: string },
    @CurrentUser() user: JwtUser,
  ) {
    return this.gamesService.setRoundWord(id, user.userId, body.word);
  }
}
