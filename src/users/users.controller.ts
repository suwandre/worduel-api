import { Controller, Get, UseGuards, NotFoundException } from '@nestjs/common';
import { UsersService } from './users.service';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { CurrentUser, type JwtUser } from '../common/decorators/user.decorator';

@Controller('users')
export class UsersController {
  constructor(private usersService: UsersService) {}

  @Get('me')
  @UseGuards(JwtAuthGuard)
  async getProfile(@CurrentUser() user: JwtUser) {
    const userProfile = await this.usersService.findById(user.userId);

    if (!userProfile) {
      throw new NotFoundException('User not found');
    }

    return {
      id: userProfile._id,
      email: userProfile.email,
      username: userProfile.username,
      gamesPlayed: userProfile.gamesPlayed,
      gamesWon: userProfile.gamesWon,
      currentStreak: userProfile.currentStreak,
      maxStreak: userProfile.maxStreak,
    };
  }

  @Get('me/stats')
  @UseGuards(JwtAuthGuard)
  async getStats(@CurrentUser() user: JwtUser) {
    const userProfile = await this.usersService.findById(user.userId);

    if (!userProfile) {
      throw new NotFoundException('User not found');
    }

    return {
      gamesPlayed: userProfile.gamesPlayed,
      gamesWon: userProfile.gamesWon,
      winRate:
        userProfile.gamesPlayed > 0
          ? Math.round((userProfile.gamesWon / userProfile.gamesPlayed) * 100)
          : 0,
      currentStreak: userProfile.currentStreak,
      maxStreak: userProfile.maxStreak,
      guessDistribution: userProfile.guessDistribution,
    };
  }
}
