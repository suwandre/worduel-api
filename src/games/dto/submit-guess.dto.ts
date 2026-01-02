import { IsString, Length } from 'class-validator';

export class SubmitGuessDto {
  @IsString()
  @Length(5, 5, { message: 'Guess must be exactly 5 letters' })
  guess: string;
}
