import {
  Controller,
  Get,
  Param,
  Patch,
  ParseUUIDPipe,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth, ApiParam, ApiQuery } from '@nestjs/swagger';
import { PaginationDto } from '../common/dto/pagination.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { UserRole } from '../common/enums/user-role.enum';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { CommentStatus } from './moderation.types';
import { ModerationService } from './moderation.service';
import { User } from '../users/user.entity';
import { ModerateCommentResponseDto } from './dto/moderate-comment.response.dto';

@ApiTags('moderation')
@ApiBearerAuth('JWT-auth')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.MODERATOR, UserRole.ADMIN)
@Controller('moderation')
export class ModerationController {
  constructor(private readonly moderationService: ModerationService) {}

  @Get('pending')
  @ApiOperation({ summary: 'Listar comentarios pendientes de moderación' })
  @ApiResponse({ status: 200, description: 'Lista paginada de comentarios pendientes', type: [ModerateCommentResponseDto] })
  @ApiResponse({ status: 401, description: 'No autorizado' })
  @ApiResponse({ status: 403, description: 'Prohibido - requiere rol MODERATOR o ADMIN' })
  @ApiQuery({ name: 'page', required: false, type: Number, description: 'Página (default: 1)' })
  @ApiQuery({ name: 'limit', required: false, type: Number, description: 'Límite por página (default: 20)' })
  async getPending(@Query() pagination: PaginationDto) {
    return this.moderationService.findPending(
      pagination.page,
      pagination.limit,
    );
  }

  @Patch(':id/approve')
  @ApiOperation({ summary: 'Aprobar comentario (publicar)' })
  @ApiParam({ name: 'id', description: 'UUID del comentario' })
  @ApiResponse({ status: 200, description: 'Comentario aprobado', type: ModerateCommentResponseDto })
  @ApiResponse({ status: 401, description: 'No autorizado' })
  @ApiResponse({ status: 403, description: 'Prohibido - requiere rol MODERATOR o ADMIN' })
  @ApiResponse({ status: 404, description: 'Comentario no encontrado' })
  @ApiResponse({ status: 409, description: 'Comentario ya procesado' })
  async approve(
    @Param('id', new ParseUUIDPipe()) id: string,
    @CurrentUser() user: User,
  ) {
    return this.moderationService.moderateComment(
      id,
      CommentStatus.PUBLISHED,
      user.id,
    );
  }

  @Patch(':id/reject')
  @ApiOperation({ summary: 'Rechazar comentario (bloquear)' })
  @ApiParam({ name: 'id', description: 'UUID del comentario' })
  @ApiResponse({ status: 200, description: 'Comentario bloqueado', type: ModerateCommentResponseDto })
  @ApiResponse({ status: 401, description: 'No autorizado' })
  @ApiResponse({ status: 403, description: 'Prohibido - requiere rol MODERATOR o ADMIN' })
  @ApiResponse({ status: 404, description: 'Comentario no encontrado' })
  @ApiResponse({ status: 409, description: 'Comentario ya procesado' })
  async reject(
    @Param('id', new ParseUUIDPipe()) id: string,
    @CurrentUser() user: User,
  ) {
    return this.moderationService.moderateComment(
      id,
      CommentStatus.BLOCKED,
      user.id,
    );
  }
}
