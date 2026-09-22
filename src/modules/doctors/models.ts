import mongoose, { Schema, Document } from 'mongoose';

export interface IDoctor extends Document {
  hospitalId: mongoose.Types.ObjectId;
  userId: mongoose.Types.ObjectId;
  licenseNumber: string;
  specialization: string[];
  qualification: string[];
  experienceYears: number;
  consultationFee: number;
  isAvailable: boolean;
}

const DoctorSchema = new Schema<IDoctor>({
  hospitalId: { type: Schema.Types.ObjectId, ref: 'Hospital', required: true, index: true },
  userId: { type: Schema.Types.ObjectId, ref: 'User', required: true, unique: true, index: true },
  licenseNumber: { type: String, required: true },
  specialization: [{ type: String, required: true }],
  qualification: [{ type: String, required: true }],
  experienceYears: { type: Number, required: true },
  consultationFee: { type: Number, required: true },
  isAvailable: { type: Boolean, default: true }
}, { timestamps: true });

export const Doctor = mongoose.model<IDoctor>('Doctor', DoctorSchema);

// Doctor Schedules Model
export interface IDoctorSchedule extends Document {
  hospitalId: mongoose.Types.ObjectId;
  doctorId: mongoose.Types.ObjectId;
  weeklySlots: {
    dayOfWeek: 'Monday' | 'Tuesday' | 'Wednesday' | 'Thursday' | 'Friday' | 'Saturday' | 'Sunday';
    startTime: string; // "09:00"
    endTime: string;   // "17:00"
    slotDuration: number; // in minutes (e.g. 15)
  }[];
  exceptions: {
    date: Date;
    isAvailable: boolean;
  }[];
}

const DoctorScheduleSchema = new Schema<IDoctorSchedule>({
  hospitalId: { type: Schema.Types.ObjectId, ref: 'Hospital', required: true, index: true },
  doctorId: { type: Schema.Types.ObjectId, ref: 'Doctor', required: true, index: true },
  weeklySlots: [{
    dayOfWeek: {
      type: String,
      enum: ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'],
      required: true
    },
    startTime: { type: String, required: true },
    endTime: { type: String, required: true },
    slotDuration: { type: Number, default: 15 }
  }],
  exceptions: [{
    date: { type: Date, required: true },
    isAvailable: { type: Boolean, default: false }
  }]
}, { timestamps: true });

export const DoctorSchedule = mongoose.model<IDoctorSchedule>('DoctorSchedule', DoctorScheduleSchema);
