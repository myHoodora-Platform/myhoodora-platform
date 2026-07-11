import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { User, UserDocument } from './schemas/user.schema';

@Injectable()
export class UsersService {
    constructor(
        @InjectModel(User.name) private readonly userModel: Model<UserDocument>,
    ) { }

    async findByUid(uid: string): Promise<UserDocument | null> {
        return this.userModel.findOne({ uid }).exec();
    }

    async findOrCreate(
        uid: string,
        partial: Partial<User>,
    ): Promise<UserDocument> {
        const existing = await this.findByUid(uid);
        if (existing) return existing;

        const created = new this.userModel({ uid, ...partial });
        return created.save();
    }

    async update(
        uid: string,
        updates: Partial<User>,
    ): Promise<UserDocument> {
        const user = await this.userModel
            .findOneAndUpdate({ uid }, updates, { new: true })
            .exec();
        if (!user) throw new NotFoundException(`User ${uid} not found`);
        return user;
    }
}
