import {
  Body,
  Controller,
  Get,
  HttpStatus,
  Post,
  Query,
  Res,
  UseGuards,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth, ApiBody, ApiQuery } from '@nestjs/swagger';
import type { Response } from 'express';
import { CommentStatus, Label } from '../moderation/moderation.types';
import { PaginationDto } from '../common/dto/pagination.dto';
import { CommentResponseDto } from './dto/comment-response.dto';
import { CreateCommentDto } from './dto/create-comment.dto';
import { CommentsService } from './comments.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { User } from '../users/user.entity';

@ApiTags('comments')
@Controller('comments')
export class CommentsController {
  constructor(private readonly commentsService: CommentsService) {}

  @Post()
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth('JWT-auth')
  @ApiOperation({ summary: 'Crear comentario (requiere autenticación)' })
  @ApiBody({ type: CreateCommentDto })
  @ApiResponse({ status: 201, description: 'Comentario publicado', type: CommentResponseDto })
  @ApiResponse({ status: 202, description: 'Comentario en revisión' })
  @ApiResponse({ status: 422, description: 'Comentario bloqueado (spam/fraude)' })
  @ApiResponse({ status: 401, description: 'No autorizado' })
  @ApiResponse({ status: 429, description: 'Rate limit excedido' })
  async create(
    @Body() createCommentDto: CreateCommentDto,
    @CurrentUser() user: User,
    @Res() res: Response,
  ) {
    const comment = await this.commentsService.create(createCommentDto, user.id);

    if (comment.status === CommentStatus.PUBLISHED) {
      return res
        .status(HttpStatus.CREATED)
        .json(new CommentResponseDto(comment));
    }

    if (comment.status === CommentStatus.PENDING_REVIEW) {
      return res.status(HttpStatus.ACCEPTED).json({
        message: 'Tu comentario está en revisión',
      });
    }

    if (comment.status === CommentStatus.BLOCKED) {
      const infractionType = comment.label === Label.FRAUD ? 'fraude' : 'spam';
      return res.status(HttpStatus.UNPROCESSABLE_ENTITY).json({
        message: `Tu comentario fue bloqueado por infringir las normas de la comunidad (${infractionType})`,
      });
    }
  }

  @Get()
  @ApiOperation({ summary: 'Listar comentarios publicados' })
  @ApiResponse({ status: 200, description: 'Lista paginada de comentarios', type: [CommentResponseDto] })
  @ApiQuery({ name: 'page', required: false, type: Number, description: 'Página (default: 1)' })
  @ApiQuery({ name: 'limit', required: false, type: Number, description: 'Límite por página (default: 20)' })
  async findAll(@Query() pagination: PaginationDto) {
    const comments = await this.commentsService.findAllPublished(
      pagination.page,
      pagination.limit,
    );

    return comments.map((comment) => new CommentResponseDto(comment));
  }
}
