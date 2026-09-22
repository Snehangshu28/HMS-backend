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
exports.Admission = exports.Bed = exports.Ward = void 0;
const mongoose_1 = __importStar(require("mongoose"));
const WardSchema = new mongoose_1.Schema({
    hospitalId: { type: mongoose_1.Schema.Types.ObjectId, ref: 'Hospital', required: true, index: true },
    name: { type: String, required: true },
    category: {
        type: String,
        enum: ['General', 'ICU', 'Emergency', 'Pediatric', 'Maternity'],
        required: true
    },
    capacity: { type: Number, required: true }
}, { timestamps: true });
exports.Ward = mongoose_1.default.model('Ward', WardSchema);
const BedSchema = new mongoose_1.Schema({
    hospitalId: { type: mongoose_1.Schema.Types.ObjectId, ref: 'Hospital', required: true, index: true },
    wardId: { type: mongoose_1.Schema.Types.ObjectId, ref: 'Ward', required: true, index: true },
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
exports.Bed = mongoose_1.default.model('Bed', BedSchema);
const AdmissionSchema = new mongoose_1.Schema({
    hospitalId: { type: mongoose_1.Schema.Types.ObjectId, ref: 'Hospital', required: true, index: true },
    patientId: { type: mongoose_1.Schema.Types.ObjectId, ref: 'Patient', required: true, index: true },
    admittedBy: { type: mongoose_1.Schema.Types.ObjectId, ref: 'Doctor', required: true },
    admissionDate: { type: Date, default: Date.now },
    reason: { type: String, required: true },
    wardId: { type: mongoose_1.Schema.Types.ObjectId, ref: 'Ward', required: true },
    bedId: { type: mongoose_1.Schema.Types.ObjectId, ref: 'Bed', required: true },
    primaryNurse: { type: mongoose_1.Schema.Types.ObjectId, ref: 'User' },
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
exports.Admission = mongoose_1.default.model('Admission', AdmissionSchema);
