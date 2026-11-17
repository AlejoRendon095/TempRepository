import { IsString, IsNotEmpty, MaxLength } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class CreateCommentDto {
  @ApiProperty({ example: 'Excelente servicio, llegó a tiempo.', description: 'Texto del comentario (máx 2000 chars)' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(2000)
  text: string;
}