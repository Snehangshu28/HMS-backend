import mongoose, { Schema, Document } from 'mongoose';

export interface ILabTest extends Document {
  hospitalId: mongoose.Types.ObjectId;
  patientId: mongoose.Types.ObjectId;
  orderedBy?: mongoose.Types.ObjectId;
  testName: string;
  code: string;
  fee: number;
  status: 'Pending' | 'Sample Collected' | 'Processing' | 'Completed' | 'Cancelled';
  createdAt: Date;
  updatedAt: Date;
}

const LabTestSchema = new Schema<ILabTest>({
  hospitalId: { type: Schema.Types.ObjectId, ref: 'Hospital', required: true, index: true },
  patientId: { type: Schema.Types.ObjectId, ref: 'Patient', required: true, index: true },
  orderedBy: { type: Schema.Types.ObjectId, ref: 'Doctor' },
  testName: { type: String, required: true },
  code: { type: String, required: true },
  fee: { type: Number, required: true },
  status: {
    type: String,
    enum: ['Pending', 'Sample Collected', 'Processing', 'Completed', 'Cancelled'],
    default: 'Pending',
    index: true
  }
}, { timestamps: true });

export const LabTest = mongoose.model<ILabTest>('LabTest', LabTestSchema);

// Sample Collection Model
export interface ISample extends Document {
  hospitalId: mongoose.Types.ObjectId;
  labTestId: mongoose.Types.ObjectId;
  barcode: string;
  sampleType: string;
  collectedBy: mongoose.Types.ObjectId;
  collectedAt: Date;
  status: 'Collected' | 'Received in Lab' | 'Rejected';
}

const SampleSchema = new Schema<ISample>({
  hospitalId: { type: Schema.Types.ObjectId, ref: 'Hospital', required: true, index: true },
  labTestId: { type: Schema.Types.ObjectId, ref: 'LabTest', required: true, index: true },
  barcode: { type: String, required: true, unique: true, index: true },
  sampleType: { type: String, required: true },
  collectedBy: { type: Schema.Types.ObjectId, ref: 'User', required: true },
  collectedAt: { type: Date, default: Date.now },
  status: {
    type: String,
    enum: ['Collected', 'Received in Lab', 'Rejected'],
    default: 'Collected'
  }
}, { timestamps: true });

export const Sample = mongoose.model<ISample>('Sample', SampleSchema);

// Lab Report Model
export interface ILabReport extends Document {
  hospitalId: mongoose.Types.ObjectId;
  labTestId: mongoose.Types.ObjectId;
  patientId: mongoose.Types.ObjectId;
  parameters: {
    name: string;
    value: string;
    unit: string;
    referenceRange?: string;
    isAbnormal: boolean;
  }[];
  uploadedBy: mongoose.Types.ObjectId;
  approvedBy?: mongoose.Types.ObjectId;
  reportFileUrl?: string;
  createdAt: Date;
}

const LabReportSchema = new Schema<ILabReport>({
  hospitalId: { type: Schema.Types.ObjectId, ref: 'Hospital', required: true, index: true },
  labTestId: { type: Schema.Types.ObjectId, ref: 'LabTest', required: true, unique: true, index: true },
  patientId: { type: Schema.Types.ObjectId, ref: 'Patient', required: true, index: true },
  parameters: [{
    name: { type: String, required: true },
    value: { type: String, required: true },
    unit: { type: String, required: true },
    referenceRange: String,
    isAbnormal: { type: Boolean, default: false }
  }],
  uploadedBy: { type: Schema.Types.ObjectId, ref: 'User', required: true },
  approvedBy: { type: Schema.Types.ObjectId, ref: 'User' },
  reportFileUrl: String
}, { timestamps: true });

export const LabReport = mongoose.model<ILabReport>('LabReport', LabReportSchema);
