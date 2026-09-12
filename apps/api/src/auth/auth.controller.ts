import { Controller, Post, Body, HttpCode, HttpStatus } from '@nestjs/common';
import {
    ApiTags,
    ApiBearerAuth,
    ApiOperation,
    ApiResponse,
} from '@nestjs/swagger';
import { AuthService } from './auth.service';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import type { DecodedIdToken } from 'firebase-admin/auth';

type LoginDto = {
    email: string;
    password: string;
};

type SignupDto = {
    email: string;
    password: string;
    displayName?: string;
};

@ApiTags('auth')
@ApiBearerAuth('firebase-jwt')
@Controller('auth')
export class AuthController {
    constructor(private readonly authService: AuthService) { }

    @Post('login')
    @HttpCode(HttpStatus.OK)
    @ApiOperation({
        summary: 'Login',
        description: 'Authenticates a user with Firebase and returns an authorization token.',
    })
    @ApiResponse({ status: 200, description: 'Successfully logged in.' })
    @ApiResponse({ status: 401, description: 'Invalid credentials.' })
    async login(@Body() payload: LoginDto): Promise<unknown> {
        return this.authService.login(payload);
    }

    @Post('signup')
    @HttpCode(HttpStatus.CREATED)
    @ApiOperation({
        summary: 'Signup',
        description: 'Registers a new user with Firebase and returns an authorization token.',
    })
    @ApiResponse({ status: 201, description: 'Successfully signed up.' })
    @ApiResponse({ status: 400, description: 'Invalid signup data.' })
    async signup(@Body() payload: SignupDto): Promise<unknown> {
        return this.authService.signup(payload);
    }

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
