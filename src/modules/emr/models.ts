import mongoose, { Schema, Document } from 'mongoose';

export interface IMedicalRecord extends Document {
  hospitalId: mongoose.Types.ObjectId;
  patientId: mongoose.Types.ObjectId;
  doctorId: mongoose.Types.ObjectId;
  appointmentId?: mongoose.Types.ObjectId;
  recordDate: Date;
  soapNotes: {
    subjective: string;
    objective: string;
    assessment: string;
    plan: string;
  };
  diagnoses: {
    code?: string;
    description: string;
    status: 'Provisional' | 'Final';
  }[];
  treatments: {
    type: string;
    details: string;
  }[];
}

const MedicalRecordSchema = new Schema<IMedicalRecord>({
  hospitalId: { type: Schema.Types.ObjectId, ref: 'Hospital', required: true, index: true },
  patientId: { type: Schema.Types.ObjectId, ref: 'Patient', required: true, index: true },
  doctorId: { type: Schema.Types.ObjectId, ref: 'Doctor', required: true, index: true },
  appointmentId: { type: Schema.Types.ObjectId, ref: 'Appointment' },
  recordDate: { type: Date, default: Date.now },
  soapNotes: {
    subjective: { type: String, default: '' },
    objective: { type: String, default: '' },
    assessment: { type: String, default: '' },
    plan: { type: String, default: '' },
  },
  diagnoses: [{
    code: String,
    description: { type: String, required: true },
    status: { type: String, enum: ['Provisional', 'Final'], default: 'Provisional' },
  }],
  treatments: [{
    type: { type: String, required: true },
    details: String,
  }],
}, { timestamps: true });

export const MedicalRecord = mongoose.model<IMedicalRecord>('MedicalRecord', MedicalRecordSchema);

export interface IPrescription extends Document {
  hospitalId: mongoose.Types.ObjectId;
  medicalRecordId?: mongoose.Types.ObjectId;
  patientId: mongoose.Types.ObjectId;
  doctorId: mongoose.Types.ObjectId;
  appointmentId?: mongoose.Types.ObjectId;
  date: Date;
  medicines: {
    medicineId?: mongoose.Types.ObjectId;
    name: string;
    dosage: string;
    frequency: string;
    duration: string;
    instructions?: string;
  }[];
  notes?: string;
  /** Handwritten pad (tablet/pen) as data URL / base64 image */
  padImage?: string;
  /** Uploaded prescription scans/photos */
  uploads: {
    name: string;
    mimeType: string;
    dataUrl: string;
    uploadedAt: Date;
  }[];
  status: 'Draft' | 'Issued' | 'Updated';
}

const PrescriptionSchema = new Schema<IPrescription>({
  hospitalId: { type: Schema.Types.ObjectId, ref: 'Hospital', required: true, index: true },
  medicalRecordId: { type: Schema.Types.ObjectId, ref: 'MedicalRecord' },
  patientId: { type: Schema.Types.ObjectId, ref: 'Patient', required: true, index: true },
  doctorId: { type: Schema.Types.ObjectId, ref: 'Doctor', required: true, index: true },
  appointmentId: { type: Schema.Types.ObjectId, ref: 'Appointment' },
  date: { type: Date, default: Date.now },
  medicines: [{
    medicineId: { type: Schema.Types.ObjectId, ref: 'Medicine' },
    name: { type: String, required: true },
    dosage: { type: String, default: '-' },
    frequency: { type: String, default: '-' },
    duration: { type: String, default: '-' },
    instructions: String,
  }],
  notes: String,
  padImage: String,
  uploads: [{
    name: String,
    mimeType: String,
    dataUrl: String,
    uploadedAt: { type: Date, default: Date.now },
  }],
  status: {
    type: String,
    enum: ['Draft', 'Issued', 'Updated'],
    default: 'Issued',
  },
}, { timestamps: true });

export const Prescription = mongoose.model<IPrescription>('Prescription', PrescriptionSchema);
