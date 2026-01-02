import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { GamesService } from './games.service';
import { GamesController } from './games.controller';
import { Game, GameSchema } from './schemas/game.schema';
import { Invite, InviteSchema } from './schemas/invite.schema';
import { UsersModule } from '../users/users.module';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: Game.name, schema: GameSchema },
      { name: Invite.name, schema: InviteSchema },
    ]),
    UsersModule,
  ],
  controllers: [GamesController],
  providers: [GamesService],
})
export class GamesModule {}
