import {
  IsNotEmpty,
  IsString,
  MaxLength,
  IsOptional,
  IsUUID,
} from 'class-validator';

export class CreatePostDto {
  @IsNotEmpty()
  @IsString()
  @MaxLength(100)
  posterName: string;

  @IsNotEmpty()
  @IsString()
  @MaxLength(25000)
  content: string;

  @IsOptional()
  @IsUUID()
  replyToId?: string;
}
