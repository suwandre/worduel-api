import { IsString, Length, IsOptional, IsMongoId } from 'class-validator';

export class CreateGameDto {
  @IsString()
  @Length(5, 5, { message: 'Target word must be exactly 5 letters' })
  targetWord: string;

  @IsOptional()
  @IsMongoId()
  opponentId?: string;
}
