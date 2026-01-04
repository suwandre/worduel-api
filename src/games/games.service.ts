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
import { WORDUEL_WORDS } from './data/words';

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
    // Validate word
    const normalizedWord = createGameDto.targetWord.toLowerCase();
    if (!WORDUEL_WORDS.includes(normalizedWord)) {
      throw new BadRequestException('Invalid target word selected');
    }

    // Initialize points map
    const points = new Map<string, number>();
    points.set(userId, 0);
    points.set(createGameDto.opponentId, 0);

    const game = new this.gameModel({
      playerId: userId,
      opponentId: createGameDto.opponentId,
      targetWord: createGameDto.targetWord.toUpperCase(),
      guesses: [],
      status: 'in_progress',
      totalRounds: createGameDto.totalRounds || 3,
      currentRound: 1,
      currentWordSetter: userId, // Creator sets first word
      currentGuesser: createGameDto.opponentId, // Opponent guesses first
      points,
      roundHistory: [],
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

  /** Calculate points earned per round: 6 for 1 guess, 5 for 2 guesses, etc. */
  private calculatePoints(guessCount: number): number {
    if (guessCount <= 0 || guessCount > 6) return 0;
    return 7 - guessCount; // 1 guess = 6 pts, 2 = 5 pts, ..., 6 = 1 pt
  }

  /** Submits a guess for a Worduel game. */
  async submitGuess(
    gameId: string,
    userId: string,
    guess: string,
  ): Promise<{
    game: Game;
    result: GuessResult[];
    isCorrect: boolean;
    roundComplete?: boolean;
  }> {
    const game = await this.findById(gameId);

    // Check if user is the current guesser
    if (game.currentGuesser.toString() !== userId) {
      throw new BadRequestException('It is not your turn to guess');
    }

    if (game.status !== GameStatus.IN_PROGRESS) {
      throw new BadRequestException('Game is not in progress');
    }

    // Validate guess length (allow any 5-letter combo)
    if (guess.length !== 5) {
      throw new BadRequestException('Guess must be exactly 5 letters');
    }

    const normalizedGuess = guess.toUpperCase();
    game.guesses.push(normalizedGuess);

    // Calculate result
    const result = this.calculateGuessResult(normalizedGuess, game.targetWord);
    const isCorrect = result.every((r) => r.status === 'correct');

    // Check if round is complete
    const maxGuesses = 6;
    const roundComplete = isCorrect || game.guesses.length >= maxGuesses;

    if (roundComplete) {
      // Award points if guessed correctly
      const pointsAwarded = isCorrect
        ? this.calculatePoints(game.guesses.length)
        : 0;

      // Update points
      const currentPoints = game.points.get(userId) || 0;
      game.points.set(userId, currentPoints + pointsAwarded);

      // Save round history
      game.roundHistory.push({
        round: game.currentRound,
        wordSetter: game.currentWordSetter,
        guesser: game.currentGuesser,
        targetWord: game.targetWord,
        guesses: [...game.guesses],
        pointsAwarded: pointsAwarded,
        completedAt: new Date(),
      });

      // Check if all rounds are complete
      if (game.currentRound >= game.totalRounds) {
        // Game over - determine winner
        const player1Id = game.playerId.toString();
        const player2Id = game.opponentId.toString();
        const player1Points = game.points.get(player1Id) || 0;
        const player2Points = game.points.get(player2Id) || 0;

        if (player1Points > player2Points) {
          game.winner = game.playerId;
        } else if (player2Points > player1Points) {
          game.winner = game.opponentId;
        }
        // If tied, winner remains undefined

        game.status = GameStatus.COMPLETED;
      } else {
        // Move to next round
        game.currentRound += 1;

        // Swap roles
        const previousGuesser = game.currentGuesser;
        const previousWordSetter = game.currentWordSetter;
        game.currentWordSetter = previousGuesser;
        game.currentGuesser = previousWordSetter;

        // Reset for next round
        game.targetWord = ''; // Will be set by new word setter
        game.guesses = [];
        game.status = GameStatus.WAITING; // Waiting for next word
      }
    }

    await game.save();
    return { game, result, isCorrect, roundComplete };
  }

  /** Sets the target word for a round in a game by the word setter. */
  async setRoundWord(
    gameId: string,
    userId: string,
    word: string,
  ): Promise<Game> {
    const game = await this.findById(gameId);

    if (game.status !== GameStatus.WAITING) {
      throw new BadRequestException('Game is not waiting for a word');
    }

    if (game.currentWordSetter.toString() !== userId) {
      throw new BadRequestException('It is not your turn to set the word');
    }

    // Validate word
    const normalizedWord = word.toLowerCase();
    if (!WORDUEL_WORDS.includes(normalizedWord)) {
      throw new BadRequestException('Invalid target word selected');
    }

    game.targetWord = word.toUpperCase();
    game.status = GameStatus.IN_PROGRESS;
    await game.save();

    return game;
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

  /** Gets `count` amount of random words from the word list. */
  getRandomWords(count: number = 4): string[] {
    const shuffled = [...WORDUEL_WORDS]
      .sort(() => Math.random() - 0.5)
      .slice(0, count)
      .map((word) => word.toUpperCase());

    return shuffled;
  }
}
