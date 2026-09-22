import mongoose, { Schema, Document } from 'mongoose';

export interface IWard extends Document {
  hospitalId: mongoose.Types.ObjectId;
  name: string;
  category: 'General' | 'ICU' | 'Emergency' | 'Pediatric' | 'Maternity';
  capacity: number;
}

const WardSchema = new Schema<IWard>({
  hospitalId: { type: Schema.Types.ObjectId, ref: 'Hospital', required: true, index: true },
  name: { type: String, required: true },
  category: {
    type: String,
    enum: ['General', 'ICU', 'Emergency', 'Pediatric', 'Maternity'],
    required: true
  },
  capacity: { type: Number, required: true }
}, { timestamps: true });

export const Ward = mongoose.model<IWard>('Ward', WardSchema);

// Bed Model
export interface IBed extends Document {
  hospitalId: mongoose.Types.ObjectId;
  wardId: mongoose.Types.ObjectId;
  bedNumber: string;
  type: 'General' | 'Semi-Private' | 'Private' | 'ICU' | 'NICU';
  status: 'Available' | 'Occupied' | 'Maintenance';
}

const BedSchema = new Schema<IBed>({
  hospitalId: { type: Schema.Types.ObjectId, ref: 'Hospital', required: true, index: true },
  wardId: { type: Schema.Types.ObjectId, ref: 'Ward', required: true, index: true },
  bedNumber: { type: String, required: true },
  type: {
    type: String,
    enum: ['General', 'Semi-Private', 'Private', 'ICU', 'NICU'],
    required: true
  },
  status: {
    type: String,
    enum: ['Available', 'Occupied', 'Maintenance'],
    default: 'Available',
    index: true
  }
}, { timestamps: true });

export const Bed = mongoose.model<IBed>('Bed', BedSchema);

// Inpatient Admission Model
export interface IAdmission extends Document {
  hospitalId: mongoose.Types.ObjectId;
  patientId: mongoose.Types.ObjectId;
  admittedBy: mongoose.Types.ObjectId;
  admissionDate: Date;
  reason: string;
  wardId: mongoose.Types.ObjectId;
  bedId: mongoose.Types.ObjectId;
  primaryNurse?: mongoose.Types.ObjectId;
  /** Human-readable unique admission ID e.g. ADM-10001 */
  admissionNumber?: string;
  /** Opaque token encoded in QR wristband */
  wristbandToken?: string;
  /** Full QR payload e.g. HMS:ADM:<token> */
  wristbandPayload?: string;
  status: 'Admitted' | 'Discharged' | 'Transferred';
  dischargeSummary?: {
    dischargeDate: Date;
    conditionAtDischarge: string;
    advice?: string;
    notes?: string;
  };
}

const AdmissionSchema = new Schema<IAdmission>({
  hospitalId: { type: Schema.Types.ObjectId, ref: 'Hospital', required: true, index: true },
  patientId: { type: Schema.Types.ObjectId, ref: 'Patient', required: true, index: true },
  admittedBy: { type: Schema.Types.ObjectId, ref: 'Doctor', required: true },
  admissionDate: { type: Date, default: Date.now },
  reason: { type: String, required: true },
  wardId: { type: Schema.Types.ObjectId, ref: 'Ward', required: true },
  bedId: { type: Schema.Types.ObjectId, ref: 'Bed', required: true },
  primaryNurse: { type: Schema.Types.ObjectId, ref: 'User' },
  admissionNumber: { type: String, index: true },
  wristbandToken: { type: String, index: true },
  wristbandPayload: { type: String, index: true },
  status: {
    type: String,
    enum: ['Admitted', 'Discharged', 'Transferred'],
    default: 'Admitted',
    index: true
  },
  dischargeSummary: {
    dischargeDate: Date,
    conditionAtDischarge: String,
    advice: String,
    notes: String
  }
}, { timestamps: true });

AdmissionSchema.index({ hospitalId: 1, admissionNumber: 1 }, { unique: true, sparse: true });
AdmissionSchema.index({ hospitalId: 1, wristbandToken: 1 }, { unique: true, sparse: true });

export const Admission = mongoose.model<IAdmission>('Admission', AdmissionSchema);
