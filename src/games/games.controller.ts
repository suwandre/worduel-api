import { Controller, Post, Get, Body, Param, UseGuards } from '@nestjs/common';
import { GamesService } from './games.service';
import { CreateGameDto } from './dto/create-game.dto';
import { SubmitGuessDto } from './dto/submit-guess.dto';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { CurrentUser } from '../common/decorators/user.decorator';

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

  @Get()
  findUserGames(@CurrentUser() user: { userId: string; email: string }) {
    return this.gamesService.findUserGames(user.userId);
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.gamesService.findById(id);
  }

  @Post(':id/guess')
  submitGuess(
    @Param('id') id: string,
    @Body() submitGuessDto: SubmitGuessDto,
    @CurrentUser() user: { userId: string; email: string },
  ) {
    return this.gamesService.submitGuess(id, user.userId, submitGuessDto.guess);
  }
}
