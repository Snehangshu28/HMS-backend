import mongoose, { Schema, Document } from 'mongoose';

export interface INotification extends Document {
  hospitalId: mongoose.Types.ObjectId;
  recipientId: mongoose.Types.ObjectId;
  title: string;
  body: string;
  type: 'System' | 'SMS' | 'WhatsApp' | 'Email';
  status: 'Unread' | 'Read' | 'Sent' | 'Failed';
  createdAt: Date;
}

const NotificationSchema = new Schema<INotification>({
  hospitalId: { type: Schema.Types.ObjectId, ref: 'Hospital', required: true, index: true },
  recipientId: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  title: { type: String, required: true },
  body: { type: String, required: true },
  type: {
    type: String,
    enum: ['System', 'SMS', 'WhatsApp', 'Email'],
    default: 'System'
  },
  status: {
    type: String,
    enum: ['Unread', 'Read', 'Sent', 'Failed'],
    default: 'Unread',
    index: true
  }
}, { timestamps: true });

export const Notification = mongoose.model<INotification>('Notification', NotificationSchema);
