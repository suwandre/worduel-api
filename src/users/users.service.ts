import { Injectable, ConflictException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { User } from './schemas/user.schema';
import * as bcrypt from 'bcrypt';

@Injectable()
export class UsersService {
  constructor(@InjectModel(User.name) private userModel: Model<User>) {}

  /** Creates a new Worduel user, storing it in the database. */
  async create(
    email: string,
    username: string,
    password: string,
  ): Promise<User> {
    const existingUser = await this.userModel.findOne({ email });
    if (existingUser) {
      throw new ConflictException('Email already exists');
    }

    const hashedPassword = await bcrypt.hash(password, 10);
    const user = new this.userModel({
      email,
      username,
      password: hashedPassword,
    });

    return user.save();
  }

  /** Finds a user by email. */
  async findByEmail(email: string): Promise<User | null> {
    return this.userModel.findOne({ email });
  }

  /** Finds a user by their database ID. */
  async findById(id: string): Promise<User | null> {
    return this.userModel.findById(id);
  }

  /** Validates a password against a hashed password. */
  async validatePassword(
    password: string,
    hashedPassword: string,
  ): Promise<boolean> {
    return bcrypt.compare(password, hashedPassword);
  }

  /** Gets `limit` amount of players to form a leaderboard based on games won and max streak. */
  async getLeaderboard(limit: number = 50): Promise<User[]> {
    return this.userModel
      .find()
      .select('username gamesPlayed gamesWon maxStreak')
      .sort({ gamesWon: -1, maxStreak: -1 })
      .limit(limit);
  }

  /** Searches for users by their username. */
  async searchByUsername(username: string) {
    return this.userModel
      .find({ username: { $regex: username, $options: 'i' } })
      .select('username email')
      .limit(10);
  }
}
