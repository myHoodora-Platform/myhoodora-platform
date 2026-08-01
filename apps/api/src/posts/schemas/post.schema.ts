import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument } from 'mongoose';

export type PostDocument = HydratedDocument<Update>;

export enum PostType {
    TEXT = 'text',
    IMAGE = 'image',
    EVENT = 'event',
    ALERT = 'alert',
}

// Named the type "Update" to avoid confusion with the "Post" decorator from @nestjs/common
@Schema({ timestamps: true, collection: 'posts' })
export class Update {
    @Prop({ required: true, index: true })
    authorUid!: string;

    @Prop({ required: true, index: true })
    neighborhoodId!: string;

    @Prop({ required: true, enum: PostType, default: PostType.TEXT })
    type!: PostType;

    @Prop({ required: true })
    content!: string;

    @Prop({ type: [String], default: [] })
    mediaUrls!: string[];

    @Prop({ type: [String], default: [] })
    likes!: string[]; // array of Firebase UIDs

    @Prop({ default: true })
    isActive!: boolean;
}

export const PostSchema = SchemaFactory.createForClass(Update);
