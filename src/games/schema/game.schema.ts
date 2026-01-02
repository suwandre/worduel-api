import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';

export enum GameStatus {
  IN_PROGRESS = 'in_progress',
  WON = 'won',
  LOST = 'lost',
}

@Schema({ timestamps: true, collection: 'games' })
export class Game extends Document {
  @Prop({ type: Types.ObjectId, ref: 'users', required: true })
  playerId: Types.ObjectId;

  @Prop({ type: Types.ObjectId, ref: 'users' })
  opponentId?: Types.ObjectId;

  @Prop({ required: true })
  targetWord: string;

  @Prop({ type: [String], default: [] })
  guesses: string[];

  @Prop({
    type: String,
    enum: GameStatus,
    default: GameStatus.IN_PROGRESS,
  })
  status: GameStatus;

  @Prop({ default: 6 })
  maxAttempts: number;

  @Prop()
  completedAt?: Date;
}

export const GameSchema = SchemaFactory.createForClass(Game);
