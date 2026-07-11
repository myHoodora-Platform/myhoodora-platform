import {
    Controller,
    Get,
    Post,
    Delete,
    Body,
    Param,
    Query,
    HttpCode,
    HttpStatus,
    Patch,
} from '@nestjs/common';
import {
    ApiTags,
    ApiBearerAuth,
    ApiOperation,
    ApiResponse,
    ApiQuery,
    ApiParam,
    ApiBody,
} from '@nestjs/swagger';
import { PostsService } from './posts.service';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import type { DecodedIdToken } from 'firebase-admin/auth';
import { Update } from './schemas/post.schema';

@ApiTags('posts')
@ApiBearerAuth('firebase-jwt')
@Controller('posts')
export class PostsController {
    constructor(private readonly postsService: PostsService) { }

    @Post()
    @ApiOperation({ summary: 'Create a post' })
    @ApiBody({
        schema: {
            type: 'object',
            required: ['neighborhoodId', 'content'],
            properties: {
                neighborhoodId: { type: 'string', example: '64e3f1a2b5c9d00012345678' },
                content: { type: 'string', example: 'Anyone know a good plumber nearby?' },
                type: { type: 'string', enum: ['text', 'image', 'event', 'alert'], default: 'text' },
                mediaUrls: { type: 'array', items: { type: 'string' } },
            },
        },
    })
    @ApiResponse({ status: 201, description: 'Post created.' })
    create(
        @CurrentUser() user: DecodedIdToken,
        @Body()
        body: {
            neighborhoodId: string;
            content: string;
            type?: string;
            mediaUrls?: string[];
        },
    ) {
        return this.postsService.create(user.uid, body as Partial<Update>);
    }

    @Get('neighborhood/:id')
    @ApiOperation({ summary: 'Get neighbourhood feed', description: 'Returns paginated posts for a neighbourhood, newest first.' })
    @ApiParam({ name: 'id', description: 'Neighbourhood MongoDB ObjectId' })
    @ApiQuery({ name: 'limit', required: false, type: Number, example: 20 })
    @ApiQuery({ name: 'skip', required: false, type: Number, example: 0 })
    @ApiResponse({ status: 200, description: 'List of posts.' })
    findByNeighborhood(
        @Param('id') id: string,
        @Query('limit') limit?: string,
        @Query('skip') skip?: string,
    ) {
        return this.postsService.findByNeighborhood(
            id,
            limit ? parseInt(limit) : 20,
            skip ? parseInt(skip) : 0,
        );
    }

    @Patch(':id/like')
    @ApiOperation({ summary: 'Toggle like', description: 'Adds or removes the current user\'s UID from the post likes array.' })
    @ApiParam({ name: 'id', description: 'Post MongoDB ObjectId' })
    @ApiResponse({ status: 200, description: 'Updated post with new likes array.' })
    toggleLike(@Param('id') id: string, @CurrentUser() user: DecodedIdToken) {
        return this.postsService.toggleLike(id, user.uid);
    }

    @Delete(':id')
    @HttpCode(HttpStatus.NO_CONTENT)
    @ApiOperation({ summary: 'Delete own post', description: 'Soft-deletes the post. Only the author can delete.' })
    @ApiParam({ name: 'id', description: 'Post MongoDB ObjectId' })
    @ApiResponse({ status: 204, description: 'Post deleted.' })
    @ApiResponse({ status: 401, description: 'Unauthorized.' })
    delete(@Param('id') id: string, @CurrentUser() user: DecodedIdToken) {
        return this.postsService.delete(id, user.uid);
    }
}
