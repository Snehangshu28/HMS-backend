"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.PatientDocument = exports.PatientHistory = exports.PatientVitals = exports.Patient = void 0;
const mongoose_1 = __importStar(require("mongoose"));
const PatientSchema = new mongoose_1.Schema({
    hospitalId: { type: mongoose_1.Schema.Types.ObjectId, ref: 'Hospital', required: true, index: true },
    userId: { type: mongoose_1.Schema.Types.ObjectId, ref: 'User' },
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
PatientSchema.pre('validate', async function (next) {
    if (this.isNew && !this.patientId) {
        const count = await mongoose_1.default.model('Patient').countDocuments({ hospitalId: this.hospitalId });
        this.patientId = `PT-${(count + 100001).toString()}`;
    }
    next();
});
exports.Patient = mongoose_1.default.model('Patient', PatientSchema);
const VitalsSchema = new mongoose_1.Schema({
    hospitalId: { type: mongoose_1.Schema.Types.ObjectId, ref: 'Hospital', required: true, index: true },
    patientId: { type: mongoose_1.Schema.Types.ObjectId, ref: 'Patient', required: true, index: true },
    recordedBy: { type: mongoose_1.Schema.Types.ObjectId, ref: 'User', required: true },
    timestamp: { type: Date, default: Date.now },
    vitals: {
        temperature: Number,
        bloodPressure: String,
        heartRate: Number,
        respiratoryRate: Number,
        oxygenSaturation: Number
    }
}, { timestamps: true });
exports.PatientVitals = mongoose_1.default.model('PatientVitals', VitalsSchema);
const HistorySchema = new mongoose_1.Schema({
    hospitalId: { type: mongoose_1.Schema.Types.ObjectId, ref: 'Hospital', required: true, index: true },
    patientId: { type: mongoose_1.Schema.Types.ObjectId, ref: 'Patient', required: true, unique: true, index: true },
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
exports.PatientHistory = mongoose_1.default.model('PatientHistory', HistorySchema);
const DocumentSchema = new mongoose_1.Schema({
    hospitalId: { type: mongoose_1.Schema.Types.ObjectId, ref: 'Hospital', required: true, index: true },
    patientId: { type: mongoose_1.Schema.Types.ObjectId, ref: 'Patient', required: true, index: true },
    title: { type: String, required: true },
    category: { type: String, enum: ['ID Proof', 'Consent Form', 'Outside Report', 'Other'], required: true },
    fileUrl: { type: String, required: true },
    uploadedBy: { type: mongoose_1.Schema.Types.ObjectId, ref: 'User', required: true }
}, { timestamps: true });
exports.PatientDocument = mongoose_1.default.model('PatientDocument', DocumentSchema);
