import {
  Controller,
  Post,
  Body,
  Get,
  UseGuards,
  Req,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth, ApiBody } from '@nestjs/swagger';
import type { Request } from 'express';
import { JwtAuthGuard } from './guards/jwt-auth.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { AuthService } from './auth.service';
import { RegisterDto } from './dto/register.dto';
import { LoginDto } from './dto/login.dto';
import { Verify2faDto } from './dto/verify-2fa.dto';
import { Enable2faDto } from './dto/enable-2fa.dto';
import { TokenPairDto, UserResponseDto, Requires2faDto, TwoFaQrResponseDto } from './dto/auth-response.dto';
import { User } from '../users/user.entity';

@ApiTags('auth')
@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Post('register')
  @ApiOperation({ summary: 'Registrar nuevo usuario' })
  @ApiResponse({ status: 201, description: 'Usuario registrado', type: TokenPairDto })
  @ApiResponse({ status: 400, description: 'Datos inválidos' })
  @ApiResponse({ status: 409, description: 'Email ya registrado' })
  async register(@Body() dto: RegisterDto): Promise<TokenPairDto> {
    return this.authService.register(dto);
  }

  @Post('login')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Iniciar sesión' })
  @ApiResponse({ status: 200, description: 'Tokens de acceso', type: TokenPairDto })
  @ApiResponse({ status: 200, description: 'Requiere 2FA', type: Requires2faDto })
  @ApiResponse({ status: 401, description: 'Credenciales inválidas' })
  async login(@Body() dto: LoginDto): Promise<TokenPairDto | Requires2faDto> {
    return this.authService.login(dto);
  }

  @Post('refresh')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Renovar access token con refresh token' })
  @ApiBody({ schema: { type: 'object', properties: { refreshToken: { type: 'string' } } } })
  @ApiResponse({ status: 200, description: 'Nuevos tokens', type: TokenPairDto })
  @ApiResponse({ status: 401, description: 'Refresh token inválido o expirado' })
  async refresh(@Body('refreshToken') refreshToken: string): Promise<TokenPairDto> {
    return this.authService.refresh(refreshToken);
  }

  @Post('logout')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Cerrar sesión (revoca access token)' })
  @ApiResponse({ status: 200, description: 'Sesión cerrada' })
  @ApiResponse({ status: 401, description: 'No autorizado' })
  async logout(@Req() req: Request): Promise<{ message: string }> {
    const authHeader = req.headers.authorization;
    const accessToken = authHeader?.replace('Bearer ', '');
    if (accessToken) {
      await this.authService.logout(accessToken);
    }
    return { message: 'Sesión cerrada correctamente' };
  }

  @Get('me')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Obtener perfil del usuario autenticado' })
  @ApiResponse({ status: 200, description: 'Perfil del usuario', type: UserResponseDto })
  @ApiResponse({ status: 401, description: 'No autorizado' })
  async me(@CurrentUser() user: User): Promise<UserResponseDto> {
    return this.authService.me(user.id);
  }

  @Get('2fa/qr')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Obtener código QR para configurar 2FA' })
  @ApiResponse({ status: 200, description: 'QR code y secreto 2FA', type: TwoFaQrResponseDto })
  @ApiResponse({ status: 401, description: 'No autorizado' })
  @ApiResponse({ status: 400, description: '2FA ya está habilitado' })
  async getTwoFaQr(@CurrentUser() user: User): Promise<TwoFaQrResponseDto> {
    return this.authService.getTwoFaSetup(user.id);
  }

  @Post('2fa/enable')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Habilitar 2FA tras confirmar código' })
  @ApiResponse({ status: 200, description: '2FA habilitado correctamente' })
  @ApiResponse({ status: 401, description: 'No autorizado o código inválido' })
  @ApiResponse({ status: 400, description: '2FA ya habilitado o falta obtener QR' })
  async enableTwoFa(@CurrentUser() user: User, @Body() dto: Enable2faDto): Promise<{ message: string }> {
    await this.authService.enableTwoFa(user.id, dto);
    return { message: '2FA habilitado correctamente' };
  }

  @Post('2fa/disable')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Deshabilitar 2FA (requiere contraseña)' })
  @ApiBody({ schema: { type: 'object', properties: { password: { type: 'string' } } } })
  @ApiResponse({ status: 200, description: '2FA deshabilitado correctamente' })
  @ApiResponse({ status: 401, description: 'No autorizado o contraseña incorrecta' })
  @ApiResponse({ status: 400, description: '2FA no está habilitado' })
  async disableTwoFa(@CurrentUser() user: User, @Body('password') password: string): Promise<{ message: string }> {
    await this.authService.disableTwoFa(user.id, password);
    return { message: '2FA deshabilitado correctamente' };
  }

  @Post('2fa/verify')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Verificar código 2FA durante login (público)' })
  @ApiResponse({ status: 200, description: 'Tokens de acceso', type: TokenPairDto })
  @ApiResponse({ status: 401, description: 'Token 2FA inválido o código incorrecto' })
  async verifyTwoFa(@Body() dto: Verify2faDto): Promise<TokenPairDto> {
    return this.authService.verifyTwoFa(dto);
  }
}