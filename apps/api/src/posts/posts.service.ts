import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { Update, PostDocument } from './schemas/post.schema';

@Injectable()
export class PostsService {
    constructor(
        @InjectModel(Update.name) private readonly postModel: Model<PostDocument>,
    ) { }

    async create(
        authorUid: string,
        payload: Partial<Update>,
    ): Promise<PostDocument> {
        const post = new this.postModel({ authorUid, ...payload });
        return post.save();
    }

    async findByNeighborhood(
        neighborhoodId: string,
        limit = 20,
        skip = 0,
    ): Promise<PostDocument[]> {
        return this.postModel
            .find({ neighborhoodId, isActive: true })
            .sort({ createdAt: -1 })
            .skip(skip)
            .limit(limit)
            .exec();
    }

    async toggleLike(postId: string, uid: string): Promise<PostDocument> {
        const post = await this.postModel.findById(postId).exec();
        if (!post) throw new NotFoundException(`Post ${postId} not found`);

        const idx = post.likes.indexOf(uid);
        if (idx === -1) {
            post.likes.push(uid);
        } else {
            post.likes.splice(idx, 1);
        }
        return post.save();
    }

    async delete(postId: string, uid: string): Promise<void> {
        await this.postModel
            .findOneAndUpdate({ _id: postId, authorUid: uid }, { isActive: false })
            .exec();
    }
}
