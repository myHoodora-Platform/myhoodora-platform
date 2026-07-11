import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument } from 'mongoose';

export type NeighborhoodDocument = HydratedDocument<Neighborhood>;

@Schema({ timestamps: true, collection: 'neighborhoods' })
export class Neighborhood {
    @Prop({ required: true, unique: true })
    name!: string;

    @Prop()
    description?: string;

    @Prop({ required: true })
    city!: string;

    @Prop({ required: true })
    country!: string;

    /** GeoJSON point for proximity queries */
    @Prop({
        type: {
            type: String,
            enum: ['Point'],
            default: 'Point',
        },
        coordinates: { type: [Number] }, // [longitude, latitude]
    })
    location?: {
        type: 'Point';
        coordinates: [number, number];
    };

    @Prop({ default: true })
    isActive!: boolean;
}

export const NeighborhoodSchema = SchemaFactory.createForClass(Neighborhood);
// Enable geo queries
NeighborhoodSchema.index({ location: '2dsphere' });
