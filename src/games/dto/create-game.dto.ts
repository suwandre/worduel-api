import {
  IsString,
  Length,
  IsMongoId,
  IsNumber,
  IsOptional,
  Min,
} from 'class-validator';

export class CreateGameDto {
  @IsString()
  @Length(5, 5)
  targetWord: string;

  @IsMongoId()
  opponentId: string;

  @IsNumber()
  @IsOptional()
  @Min(1)
  totalRounds?: number = 3; // Default to 3 rounds
}
