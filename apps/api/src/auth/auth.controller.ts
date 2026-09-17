import { Controller, Post, HttpCode, HttpStatus } from '@nestjs/common';
import {
    ApiTags,
    ApiBearerAuth,
    ApiOperation,
    ApiResponse,
} from '@nestjs/swagger';
import { AuthService } from './auth.service';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import type { DecodedIdToken } from 'firebase-admin/auth';

@ApiTags('auth')
@ApiBearerAuth('firebase-jwt')
@Controller('auth')
export class AuthController {
    constructor(private readonly authService: AuthService) { }

    @Post('logout')
    @HttpCode(HttpStatus.NO_CONTENT)
    @ApiOperation({
        summary: 'Logout',
        description: 'Revokes the current user\'s Firebase refresh tokens server-side.',
    })
    @ApiResponse({ status: 204, description: 'Successfully logged out.' })
    @ApiResponse({ status: 401, description: 'Missing or invalid Firebase token.' })
    async logout(@CurrentUser() user: DecodedIdToken): Promise<void> {
        await this.authService.revokeTokens(user.uid);
    }
}
