import mongoose, { Schema, Document } from 'mongoose';
import bcrypt from 'bcryptjs';

export interface IUser extends Document {
  hospitalId?: mongoose.Types.ObjectId;
  email: string;
  passwordHash: string;
  role: 'Super Admin' | 'Hospital Admin' | 'Doctor' | 'Receptionist' | 'Nurse' | 'Lab Technician' | 'Pharmacist' | 'Accountant' | 'Patient';
  name: { first: string; last: string };
  phone?: string;
  avatar?: string;
  isActive: boolean;
  lastLogin?: Date;
  deviceTokens: string[];
  isDeleted: boolean;
  comparePassword(password: string): Promise<boolean>;
  createdAt: Date;
  updatedAt: Date;
}

const UserSchema = new Schema<IUser>({
  hospitalId: { type: Schema.Types.ObjectId, ref: 'Hospital', index: true },
  email: { type: String, required: true, unique: true, lowercase: true, trim: true },
  passwordHash: { type: String, required: true },
  role: {
    type: String,
    enum: ['Super Admin', 'Hospital Admin', 'Doctor', 'Receptionist', 'Nurse', 'Lab Technician', 'Pharmacist', 'Accountant', 'Patient'],
    required: true
  },
  name: {
    first: { type: String, required: true },
    last: { type: String, required: true }
  },
  phone: String,
  avatar: String,
  isActive: { type: Boolean, default: true },
  lastLogin: Date,
  deviceTokens: [String],
  isDeleted: { type: Boolean, default: false }
}, { timestamps: true });

UserSchema.pre<IUser>('save', async function (next) {
  if (!this.isModified('passwordHash')) return next();
  try {
    // Skip if already a bcrypt hash (prevents accidental double-hash)
    if (typeof this.passwordHash === 'string' && /^\$2[aby]\$/.test(this.passwordHash)) {
      return next();
    }
    const salt = await bcrypt.genSalt(10);
    this.passwordHash = await bcrypt.hash(this.passwordHash, salt);
    next();
  } catch (error: any) {
    next(error);
  }
});

UserSchema.methods.comparePassword = async function (password: string): Promise<boolean> {
  return bcrypt.compare(password, this.passwordHash);
};

export const User = mongoose.model<IUser>('User', UserSchema);
