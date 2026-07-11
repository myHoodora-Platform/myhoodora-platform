import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument } from 'mongoose';

export type UserDocument = HydratedDocument<User>;

@Schema({ timestamps: true, collection: 'users' })
export class User {
    @Prop({ required: true, unique: true, index: true })
    uid!: string; // Firebase UID

    @Prop({ required: true })
    email!: string;

    @Prop()
    displayName?: string;

    @Prop()
    photoURL?: string;

    @Prop({ default: 'email' })
    provider!: string; // 'google' | 'facebook' | 'email'

    @Prop()
    neighborhoodId?: string;

    @Prop({ default: true })
    isActive!: boolean;
}

export const UserSchema = SchemaFactory.createForClass(User);
