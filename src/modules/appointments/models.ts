import mongoose, { Schema, Document } from 'mongoose';

export interface IAppointment extends Document {
  hospitalId: mongoose.Types.ObjectId;
  patientId: mongoose.Types.ObjectId;
  doctorId: mongoose.Types.ObjectId;
  scheduledDate: Date;
  startTime: string; // "09:00"
  endTime: string;
  status: 'Scheduled' | 'Checked-In' | 'In-Progress' | 'Completed' | 'Cancelled' | 'No-Show';
  type: 'OPD' | 'IPD' | 'Follow-up' | 'Emergency' | 'Teleconsult';
  notes?: string;
  cancellationReason?: string;
  createdAt: Date;
  updatedAt: Date;
}

const AppointmentSchema = new Schema<IAppointment>({
  hospitalId: { type: Schema.Types.ObjectId, ref: 'Hospital', required: true, index: true },
  patientId: { type: Schema.Types.ObjectId, ref: 'Patient', required: true, index: true },
  doctorId: { type: Schema.Types.ObjectId, ref: 'Doctor', required: true, index: true },
  scheduledDate: { type: Date, required: true, index: true },
  startTime: { type: String, required: true },
  endTime: { type: String, required: true },
  status: {
    type: String,
    enum: ['Scheduled', 'Checked-In', 'In-Progress', 'Completed', 'Cancelled', 'No-Show'],
    default: 'Scheduled',
    index: true
  },
  type: {
    type: String,
    enum: ['OPD', 'IPD', 'Follow-up', 'Emergency', 'Teleconsult'],
    default: 'OPD'
  },
  notes: String,
  cancellationReason: String
}, { timestamps: true });

export const Appointment = mongoose.model<IAppointment>('Appointment', AppointmentSchema);

// Live Queue Tracker Model
export interface IQueue extends Document {
  hospitalId: mongoose.Types.ObjectId;
  doctorId: mongoose.Types.ObjectId;
  date: Date;
  activeQueue: {
    appointmentId: mongoose.Types.ObjectId;
    patientId: mongoose.Types.ObjectId;
    tokenNumber: number;
    status: 'Waiting' | 'Called' | 'In-Consultation' | 'Completed' | 'Skipped';
  }[];
}

const QueueSchema = new Schema<IQueue>({
  hospitalId: { type: Schema.Types.ObjectId, ref: 'Hospital', required: true, index: true },
  doctorId: { type: Schema.Types.ObjectId, ref: 'Doctor', required: true, index: true },
  date: { type: Date, required: true, index: true },
  activeQueue: [{
    appointmentId: { type: Schema.Types.ObjectId, ref: 'Appointment', required: true },
    patientId: { type: Schema.Types.ObjectId, ref: 'Patient', required: true },
    tokenNumber: { type: Number, required: true },
    status: {
      type: String,
      enum: ['Waiting', 'Called', 'In-Consultation', 'Completed', 'Skipped'],
      default: 'Waiting'
    }
  }]
}, { timestamps: true });

export const Queue = mongoose.model<IQueue>('Queue', QueueSchema);
