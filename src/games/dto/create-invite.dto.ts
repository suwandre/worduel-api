import { IsMongoId, IsOptional, IsString, MaxLength } from 'class-validator';

export class CreateInviteDto {
  @IsMongoId()
  receiverId: string;

  @IsOptional()
  @IsString()
  @MaxLength(200)
  message?: string;
}
