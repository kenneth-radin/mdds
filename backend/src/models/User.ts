import { Schema, model, Document, Types } from 'mongoose';

export type UserRole = 'admin' | 'technician' | 'viewer';

export interface IUser extends Document {
  _id: Types.ObjectId;
  name: string;
  email: string;
  username: string;
  passwordHash: string;
  role: UserRole;
  title: string;
  createdAt: Date;
  updatedAt: Date;
}

const userSchema = new Schema<IUser>(
  {
    name: { type: String, required: true, trim: true },
    email: { type: String, required: true, unique: true, lowercase: true, trim: true },
    username: { type: String, required: true, unique: true, lowercase: true, trim: true },
    passwordHash: { type: String, required: true },
    role: { type: String, enum: ['admin', 'technician', 'viewer'], default: 'technician' },
    title: { type: String, default: '', trim: true }
  },
  { timestamps: true }
);

export const User = model<IUser>('User', userSchema);
