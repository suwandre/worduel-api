import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

@Schema({ timestamps: true })
export class User extends Document {
  @Prop({ required: true, unique: true })
  email: string;

  @Prop({ required: true })
  username: string;

  @Prop({ required: true })
  password: string;

  @Prop({ default: 0 })
  gamesPlayed: number;

  @Prop({ default: 0 })
  gamesWon: number;

  @Prop({ default: 0 })
  currentStreak: number;

  @Prop({ default: 0 })
  maxStreak: number;

  /** The amount of times the player guessed a word within 1, 2, ..., or 6 tries. */
  @Prop({ type: Object, default: { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0, 6: 0 } })
  guessDistribution: Record<number, number>;
}

export const UserSchema = SchemaFactory.createForClass(User);
