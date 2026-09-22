import mongoose, { Schema, Document } from 'mongoose';

export interface IHospital extends Document {
  name: string;
  subdomain: string;
  logo?: string;
  address?: { street?: string; city?: string; state?: string; zip?: string };
  contact?: { email?: string; phone?: string };
  subscription: { plan: string; status: string; expiresAt?: Date };
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const HospitalSchema = new Schema<IHospital>({
  name: { type: String, required: true },
  subdomain: { type: String, required: true, unique: true, index: true },
  logo: String,
  address: {
    street: String,
    city: String,
    state: String,
    zip: String
  },
  contact: {
    email: String,
    phone: String
  },
  subscription: {
    plan: { type: String, default: 'Free' },
    status: { type: String, default: 'Active' },
    expiresAt: Date
  },
  isActive: { type: Boolean, default: true }
}, { timestamps: true });

export const Hospital = mongoose.model<IHospital>('Hospital', HospitalSchema);
