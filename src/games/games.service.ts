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
import { Invite, InviteStatus } from './schemas/invite.schema';
import { CreateInviteDto } from './dto/create-invite.dto';

export interface GuessResult {
  letter: string;
  status: 'correct' | 'present' | 'absent';
}

@Injectable()
export class GamesService {
  constructor(
    @InjectModel(Game.name) private gameModel: Model<Game>,
    @InjectModel(Invite.name) private inviteModel: Model<Invite>,
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

    // NEW: Check if user is the opponent (not the creator)
    if (game.playerId.toString() === userId) {
      throw new BadRequestException(
        'You cannot play your own game. Wait for an opponent to guess.',
      );
    }

    // Check if user is the designated opponent (if set)
    if (game.opponentId && game.opponentId.toString() !== userId) {
      throw new BadRequestException('You are not the opponent for this game');
    }

    // If no opponent set yet, assign this user as opponent
    if (!game.opponentId) {
      game.opponentId = new Types.ObjectId(userId);
    }

    // Check if game is already finished
    if (game.status !== GameStatus.IN_PROGRESS) {
      throw new BadRequestException('Game is already finished');
    }

    // Add guess
    game.guesses.push(guess.toLowerCase());

    // Calculate result
    const result = this.calculateGuessResult(
      guess.toLowerCase(),
      game.targetWord,
    );
    const isCorrect = guess.toLowerCase() === game.targetWord;

    // Update game status
    if (isCorrect) {
      game.status = GameStatus.WON;
      game.completedAt = new Date();

      // Update opponent's stats (the one who guessed)
      await this.updateUserStats(userId, true, game.guesses.length);
    } else if (game.guesses.length >= game.maxAttempts) {
      game.status = GameStatus.LOST;
      game.completedAt = new Date();

      // Update opponent's stats (the one who guessed)
      await this.updateUserStats(userId, false, game.guesses.length);
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

  /** Creates and sends an invite from one player to another player. */
  async createInvite(
    senderId: string,
    createInviteDto: CreateInviteDto,
  ): Promise<Invite> {
    // Check if receiver exists
    const receiver = await this.usersService.findById(
      createInviteDto.receiverId,
    );
    if (!receiver) {
      throw new NotFoundException('Receiver not found');
    }

    // Can't invite yourself
    if (senderId === createInviteDto.receiverId) {
      throw new BadRequestException('Cannot invite yourself');
    }

    // Check for existing pending invite
    const existingInvite = await this.inviteModel.findOne({
      senderId: new Types.ObjectId(senderId),
      receiverId: new Types.ObjectId(createInviteDto.receiverId),
      status: InviteStatus.PENDING,
    });

    if (existingInvite) {
      throw new BadRequestException(
        'You already have a pending invite to this user',
      );
    }

    const invite = new this.inviteModel({
      senderId: new Types.ObjectId(senderId),
      receiverId: new Types.ObjectId(createInviteDto.receiverId),
      message: createInviteDto.message,
    });

    return invite.save();
  }

  /** Responds to an existing invite from another player. */
  async respondToInvite(
    inviteId: string,
    userId: string,
    accept: boolean,
  ): Promise<Game | null> {
    const invite = await this.inviteModel.findById(inviteId);

    if (!invite) {
      throw new NotFoundException('Invite not found');
    }

    if (invite.receiverId.toString() !== userId) {
      throw new BadRequestException('You are not the recipient of this invite');
    }

    if (invite.status !== InviteStatus.PENDING) {
      throw new BadRequestException('Invite is no longer pending');
    }

    if (accept) {
      invite.status = InviteStatus.ACCEPTED;

      // Create a game where sender picks the word
      const game = new this.gameModel({
        playerId: invite.senderId,
        opponentId: invite.receiverId,
        targetWord: 'PLACEHOLDER', // Sender will set this
        maxAttempts: 6,
      });

      await game.save();
      invite.gameId = game._id;
      await invite.save();

      return game;
    } else {
      invite.status = InviteStatus.DECLINED;
      await invite.save();
      return null;
    }
  }

  /** Gets all invites sent or received by a player. */
  async getUserInvites(
    userId: string,
  ): Promise<{ sent: Invite[]; received: Invite[] }> {
    const sent = await this.inviteModel
      .find({ senderId: new Types.ObjectId(userId) })
      .populate('receiverId', 'username email')
      .sort({ createdAt: -1 });

    const received = await this.inviteModel
      .find({ receiverId: new Types.ObjectId(userId) })
      .populate('senderId', 'username email')
      .sort({ createdAt: -1 });

    return { sent, received };
  }

  /** Sets the target word for a game. */
  async setGameWord(
    gameId: string,
    userId: string,
    targetWord: string,
  ): Promise<Game> {
    const game = await this.findById(gameId);

    if (game.playerId.toString() !== userId) {
      throw new BadRequestException('Only the game creator can set the word');
    }

    if (game.targetWord !== 'PLACEHOLDER') {
      throw new BadRequestException('Word has already been set');
    }

    game.targetWord = targetWord.toLowerCase();
    return game.save();
  }
}
