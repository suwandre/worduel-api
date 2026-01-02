import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { Game, GameStatus } from './schemas/game.schema';
import { CreateGameDto } from './dto/create-game.dto';
import { UsersService } from 'src/users/users.service';

export interface GuessResult {
  letter: string;
  status: 'correct' | 'present' | 'absent';
}

@Injectable()
export class GamesService {
  constructor(
    @InjectModel(Game.name) private gameModel: Model<Game>,
    private usersService: UsersService,
  ) {}

  /** Creates a new Worduel game between two players. */
  async create(userId: string, createGameDto: CreateGameDto): Promise<Game> {
    const game = new this.gameModel({
      playerId: new Types.ObjectId(userId),
      targetWord: createGameDto.targetWord.toLowerCase(),
      opponentId: createGameDto.opponentId
        ? new Types.ObjectId(createGameDto.opponentId)
        : undefined,
    });
    return game.save();
  }

  /** Finds a Worduel game by its database ID. */
  async findById(gameId: string): Promise<Game> {
    const game = await this.gameModel.findById(gameId);
    if (!game) {
      throw new NotFoundException('Game not found');
    }
    return game;
  }

  async findUserGames(userId: string): Promise<Game[]> {
    return this.gameModel
      .find({
        $or: [
          { playerId: new Types.ObjectId(userId) },
          { opponentId: new Types.ObjectId(userId) },
        ],
      })
      .sort({ createdAt: -1 });
  }

  /** Submits a guess for a Worduel game. */
  async submitGuess(
    gameId: string,
    userId: string,
    guess: string,
  ): Promise<{ game: Game; result: GuessResult[]; isCorrect: boolean }> {
    const game = await this.findById(gameId);

    if (
      game.playerId.toString() !== userId &&
      (!game.opponentId || game.opponentId.toString() !== userId)
    ) {
      throw new BadRequestException('You are not part of this game');
    }

    if (game.status !== GameStatus.IN_PROGRESS) {
      throw new BadRequestException('Game is already finished');
    }

    game.guesses.push(guess.toLowerCase());

    const result = this.calculateGuessResult(
      guess.toLowerCase(),
      game.targetWord,
    );
    const isCorrect = guess.toLowerCase() === game.targetWord;

    if (isCorrect) {
      game.status = GameStatus.WON;
      game.completedAt = new Date();
      await this.updateUserStats(userId, true, game.guesses.length); // Add this
    } else if (game.guesses.length >= game.maxAttempts) {
      game.status = GameStatus.LOST;
      game.completedAt = new Date();
      await this.updateUserStats(userId, false, game.guesses.length); // Add this
    }

    await game.save();

    return { game, result, isCorrect };
  }

  /** Analyzes a player's guess and checks the result. */
  private calculateGuessResult(guess: string, target: string): GuessResult[] {
    const result: GuessResult[] = [];
    const targetLetters = target.split('');
    const guessLetters = guess.split('');

    // Track which letters in target have been matched
    // Initialize first with [false, false, false, false, false]
    // and ['absent', 'absent', 'absent', 'absent', 'absent'] respectively
    const targetUsed = new Array(target.length).fill(false);
    const guessStatus = new Array(guess.length).fill('absent');

    // First pass: Mark correct positions (green)
    for (let i = 0; i < guessLetters.length; i++) {
      if (guessLetters[i] === targetLetters[i]) {
        guessStatus[i] = 'correct';
        targetUsed[i] = true;
      }
    }

    // Second pass: Mark present letters (yellow)
    for (let i = 0; i < guessLetters.length; i++) {
      if (guessStatus[i] === 'correct') continue;

      for (let j = 0; j < targetLetters.length; j++) {
        if (!targetUsed[j] && guessLetters[i] === targetLetters[j]) {
          guessStatus[i] = 'present';
          targetUsed[j] = true;
          break;
        }
      }
    }

    // Build result array
    for (let i = 0; i < guessLetters.length; i++) {
      result.push({
        letter: guessLetters[i],
        status: guessStatus[i] as 'correct' | 'present' | 'absent',
      });
    }

    return result;
  }

  /** Updates a player's game statistics. */
  private async updateUserStats(
    userId: string,
    won: boolean,
    numberOfGuesses: number,
  ): Promise<void> {
    const user = await this.usersService.findById(userId);
    if (!user) return;

    user.gamesPlayed += 1;

    if (won) {
      user.gamesWon += 1;
      user.currentStreak += 1;

      if (user.currentStreak > user.maxStreak) {
        user.maxStreak = user.currentStreak;
      }

      // Update guess distribution
      user.guessDistribution[numberOfGuesses] =
        (user.guessDistribution[numberOfGuesses] || 0) + 1;
    } else {
      user.currentStreak = 0;
    }

    await user.save();
  }
}
