import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';

export enum GameStatus {
  WAITING = 'waiting', // Waiting for word setter to choose word
  IN_PROGRESS = 'in_progress', // Round is active, guesser is playing
  COMPLETED = 'completed', // All rounds finished
  ABANDONED = 'abandoned', // Game was quit/abandoned
}

export interface SingleRoundHistory {
  round: number;
  wordSetter: Types.ObjectId;
  guesser: Types.ObjectId;
  targetWord: string;
  guesses: string[];
  pointsAwarded: number;
  completedAt: Date;
}

@Schema({ timestamps: true, collection: 'games' })
export class Game extends Document {
  @Prop({ type: Types.ObjectId, ref: 'users', required: true })
  playerId: Types.ObjectId;

  @Prop({ type: Types.ObjectId, ref: 'users' })
  opponentId: Types.ObjectId;

  @Prop({ required: true })
  targetWord: string;

  @Prop({ type: [String], default: [] })
  guesses: string[];

  @Prop({
    type: String,
    enum: Object.values(GameStatus),
    default: GameStatus.IN_PROGRESS,
  })
  status: GameStatus;

  @Prop({ required: true, default: 3 })
  totalRounds: number;

  @Prop({ required: true, default: 1 })
  currentRound: number;

  @Prop({ type: Types.ObjectId, ref: 'users', required: true })
  currentGuesser: Types.ObjectId; // Who is guessing this round

  @Prop({ type: Types.ObjectId, ref: 'users', required: true })
  currentWordSetter: Types.ObjectId; // Who set the word this round

  // Points tracking
  @Prop({ type: Map, of: Number, default: {} })
  points: Map<string, number>; // userId -> total points

  @Prop({
    type: [
      {
        round: Number,
        wordSetter: Types.ObjectId,
        guesser: Types.ObjectId,
        targetWord: String,
        guesses: [String],
        pointsAwarded: Number,
        completedAt: Date,
      },
    ],
    default: [],
  })
  roundHistory: SingleRoundHistory[];

  @Prop({ type: Types.ObjectId, ref: 'users' })
  winner?: Types.ObjectId;

  @Prop()
  completedAt?: Date;
}

export const GameSchema = SchemaFactory.createForClass(Game);
