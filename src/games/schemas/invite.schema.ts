import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';

export enum InviteStatus {
  PENDING = 'pending',
  ACCEPTED = 'accepted',
  DECLINED = 'declined',
  EXPIRED = 'expired',
}

@Schema({ timestamps: true, collection: 'invites' })
export class Invite extends Document {
  @Prop({ type: Types.ObjectId, ref: 'User', required: true })
  senderId: Types.ObjectId;

  @Prop({ type: Types.ObjectId, ref: 'User', required: true })
  receiverId: Types.ObjectId;

  @Prop({ type: Types.ObjectId, ref: 'Game' })
  gameId?: Types.ObjectId;

  @Prop({
    type: String,
    enum: InviteStatus,
    default: InviteStatus.PENDING,
  })
  status: InviteStatus;

  @Prop()
  message?: string;

  createdAt: Date;
  updatedAt: Date;
}

export const InviteSchema = SchemaFactory.createForClass(Invite);
