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
exports.Prescription = exports.MedicalRecord = void 0;
const mongoose_1 = __importStar(require("mongoose"));
const MedicalRecordSchema = new mongoose_1.Schema({
    hospitalId: { type: mongoose_1.Schema.Types.ObjectId, ref: 'Hospital', required: true, index: true },
    patientId: { type: mongoose_1.Schema.Types.ObjectId, ref: 'Patient', required: true, index: true },
    doctorId: { type: mongoose_1.Schema.Types.ObjectId, ref: 'Doctor', required: true, index: true },
    appointmentId: { type: mongoose_1.Schema.Types.ObjectId, ref: 'Appointment' },
    recordDate: { type: Date, default: Date.now },
    soapNotes: {
        subjective: { type: String, required: true },
        objective: String,
        assessment: { type: String, required: true },
        plan: String
    },
    diagnoses: [{
            code: String,
            description: { type: String, required: true },
            status: { type: String, enum: ['Provisional', 'Final'], default: 'Provisional' }
        }],
    treatments: [{
            type: { type: String, required: true },
            details: String
        }]
}, { timestamps: true });
exports.MedicalRecord = mongoose_1.default.model('MedicalRecord', MedicalRecordSchema);
const PrescriptionSchema = new mongoose_1.Schema({
    hospitalId: { type: mongoose_1.Schema.Types.ObjectId, ref: 'Hospital', required: true, index: true },
    medicalRecordId: { type: mongoose_1.Schema.Types.ObjectId, ref: 'MedicalRecord' },
    patientId: { type: mongoose_1.Schema.Types.ObjectId, ref: 'Patient', required: true, index: true },
    doctorId: { type: mongoose_1.Schema.Types.ObjectId, ref: 'Doctor', required: true, index: true },
    date: { type: Date, default: Date.now },
    medicines: [{
            medicineId: { type: mongoose_1.Schema.Types.ObjectId, ref: 'Medicine' },
            name: { type: String, required: true },
            dosage: { type: String, required: true },
            frequency: { type: String, required: true },
            duration: { type: String, required: true },
            instructions: String
        }],
    notes: String
}, { timestamps: true });
exports.Prescription = mongoose_1.default.model('Prescription', PrescriptionSchema);
