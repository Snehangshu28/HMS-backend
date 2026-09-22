import mongoose, { Schema, Document } from 'mongoose';

// Patient Model
export interface IPatient extends Document {
  hospitalId: mongoose.Types.ObjectId;
  userId?: mongoose.Types.ObjectId;
  patientId: string;
  qrCodeUrl?: string;
  name: { first: string; middle?: string; last: string };
  dateOfBirth: Date;
  gender: 'Male' | 'Female' | 'Other';
  contact: { email?: string; phone: string };
  address: { street?: string; city?: string; state?: string; zip?: string };
  emergencyContact: { name: string; relationship: string; phone: string };
  bloodGroup?: string;
  isDeleted: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const PatientSchema = new Schema<IPatient>({
  hospitalId: { type: Schema.Types.ObjectId, ref: 'Hospital', required: true, index: true },
  userId: { type: Schema.Types.ObjectId, ref: 'User' },
  patientId: { type: String, unique: true, index: true },
  qrCodeUrl: String,
  name: {
    first: { type: String, required: true },
    middle: String,
    last: { type: String, required: true }
  },
  dateOfBirth: { type: Date, required: true },
  gender: { type: String, enum: ['Male', 'Female', 'Other'], required: true },
  contact: {
    email: String,
    phone: { type: String, required: true }
  },
  address: {
    street: String,
    city: String,
    state: String,
    zip: String
  },
  emergencyContact: {
    name: { type: String, required: true },
    relationship: { type: String, required: true },
    phone: { type: String, required: true }
  },
  bloodGroup: String,
  isDeleted: { type: Boolean, default: false }
}, { timestamps: true });

// Pre-save validate hook to generate unique patient ID if not present
PatientSchema.pre<IPatient>('validate', async function (next) {
  if (this.isNew && !this.patientId) {
    const count = await mongoose.model('Patient').countDocuments({ hospitalId: this.hospitalId });
    this.patientId = `PT-${(count + 100001).toString()}`;
  }
  next();
});

export const Patient = mongoose.model<IPatient>('Patient', PatientSchema);

// Patient Vitals Model
export interface IPatientVitals extends Document {
  hospitalId: mongoose.Types.ObjectId;
  patientId: mongoose.Types.ObjectId;
  recordedBy: mongoose.Types.ObjectId;
  timestamp: Date;
  vitals: {
    temperature: number;
    bloodPressure: string;
    heartRate: number;
    respiratoryRate: number;
    oxygenSaturation: number;
  };
}

const VitalsSchema = new Schema<IPatientVitals>({
  hospitalId: { type: Schema.Types.ObjectId, ref: 'Hospital', required: true, index: true },
  patientId: { type: Schema.Types.ObjectId, ref: 'Patient', required: true, index: true },
  recordedBy: { type: Schema.Types.ObjectId, ref: 'User', required: true },
  timestamp: { type: Date, default: Date.now },
  vitals: {
    temperature: Number,
    bloodPressure: String,
    heartRate: Number,
    respiratoryRate: Number,
    oxygenSaturation: Number
  }
}, { timestamps: true });

export const PatientVitals = mongoose.model<IPatientVitals>('PatientVitals', VitalsSchema);

// Patient History Model
export interface IPatientHistory extends Document {
  hospitalId: mongoose.Types.ObjectId;
  patientId: mongoose.Types.ObjectId;
  allergies: { allergen: string; severity: string; reaction: string }[];
  chronicConditions: string[];
  surgicalHistory: { surgery: string; date: Date }[];
  familyHistory: { condition: string; relationship: string }[];
}

const HistorySchema = new Schema<IPatientHistory>({
  hospitalId: { type: Schema.Types.ObjectId, ref: 'Hospital', required: true, index: true },
  patientId: { type: Schema.Types.ObjectId, ref: 'Patient', required: true, unique: true, index: true },
  allergies: [{
    allergen: String,
    severity: { type: String, enum: ['Low', 'Medium', 'High', 'Critical'] },
    reaction: String
  }],
  chronicConditions: [String],
  surgicalHistory: [{
    surgery: String,
    date: Date
  }],
  familyHistory: [{
    condition: String,
    relationship: String
  }]
}, { timestamps: true });

export const PatientHistory = mongoose.model<IPatientHistory>('PatientHistory', HistorySchema);

// Patient Document Model
export interface IPatientDocument extends Document {
  hospitalId: mongoose.Types.ObjectId;
  patientId: mongoose.Types.ObjectId;
  title: string;
  category: 'ID Proof' | 'Consent Form' | 'Outside Report' | 'Other';
  fileUrl: string;
  uploadedBy: mongoose.Types.ObjectId;
  createdAt: Date;
}

const DocumentSchema = new Schema<IPatientDocument>({
  hospitalId: { type: Schema.Types.ObjectId, ref: 'Hospital', required: true, index: true },
  patientId: { type: Schema.Types.ObjectId, ref: 'Patient', required: true, index: true },
  title: { type: String, required: true },
  category: { type: String, enum: ['ID Proof', 'Consent Form', 'Outside Report', 'Other'], required: true },
  fileUrl: { type: String, required: true },
  uploadedBy: { type: Schema.Types.ObjectId, ref: 'User', required: true }
}, { timestamps: true });

export const PatientDocument = mongoose.model<IPatientDocument>('PatientDocument', DocumentSchema);
