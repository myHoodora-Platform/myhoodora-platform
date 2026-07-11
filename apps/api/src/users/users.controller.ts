import { Controller, Get, Patch, Body } from '@nestjs/common';
import {
    ApiTags,
    ApiBearerAuth,
    ApiOperation,
    ApiResponse,
    ApiBody,
} from '@nestjs/swagger';
import { UsersService } from './users.service';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import type { DecodedIdToken } from 'firebase-admin/auth';

@ApiTags('users')
@ApiBearerAuth('firebase-jwt')
@Controller('users')
export class UsersController {
    constructor(private readonly usersService: UsersService) { }

    @Get('me')
    @ApiOperation({
        summary: 'Get current user',
        description: 'Returns the authenticated user\'s profile. Auto-creates the document on first call.',
    })
    @ApiResponse({ status: 200, description: 'User profile returned.' })
    @ApiResponse({ status: 401, description: 'Missing or invalid Firebase token.' })
    async getMe(@CurrentUser() user: DecodedIdToken) {
        return this.usersService.findOrCreate(user.uid, {
            email: user.email,
            displayName: user.name,
            photoURL: user.picture,
            provider: user.firebase.sign_in_provider,
        });
    }

    @Patch('me')
    @ApiOperation({ summary: 'Update current user', description: 'Update display name or neighborhood.' })
    @ApiBody({
        schema: {
            type: 'object',
            properties: {
                displayName: { type: 'string', example: 'Jane Hoodora' },
                neighborhoodId: { type: 'string', example: '64e3f1a2b5c9d00012345678' },
            },
        },
    })
    @ApiResponse({ status: 200, description: 'User profile updated.' })
    @ApiResponse({ status: 401, description: 'Missing or invalid Firebase token.' })
    async updateMe(
        @CurrentUser() user: DecodedIdToken,
        @Body() body: { displayName?: string; neighborhoodId?: string },
    ) {
        return this.usersService.update(user.uid, body);
    }
}
