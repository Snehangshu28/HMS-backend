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
exports.LabReport = exports.Sample = exports.LabTest = void 0;
const mongoose_1 = __importStar(require("mongoose"));
const LabTestSchema = new mongoose_1.Schema({
    hospitalId: { type: mongoose_1.Schema.Types.ObjectId, ref: 'Hospital', required: true, index: true },
    patientId: { type: mongoose_1.Schema.Types.ObjectId, ref: 'Patient', required: true, index: true },
    orderedBy: { type: mongoose_1.Schema.Types.ObjectId, ref: 'Doctor' },
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
exports.LabTest = mongoose_1.default.model('LabTest', LabTestSchema);
const SampleSchema = new mongoose_1.Schema({
    hospitalId: { type: mongoose_1.Schema.Types.ObjectId, ref: 'Hospital', required: true, index: true },
    labTestId: { type: mongoose_1.Schema.Types.ObjectId, ref: 'LabTest', required: true, index: true },
    barcode: { type: String, required: true, unique: true, index: true },
    sampleType: { type: String, required: true },
    collectedBy: { type: mongoose_1.Schema.Types.ObjectId, ref: 'User', required: true },
    collectedAt: { type: Date, default: Date.now },
    status: {
        type: String,
        enum: ['Collected', 'Received in Lab', 'Rejected'],
        default: 'Collected'
    }
}, { timestamps: true });
exports.Sample = mongoose_1.default.model('Sample', SampleSchema);
const LabReportSchema = new mongoose_1.Schema({
    hospitalId: { type: mongoose_1.Schema.Types.ObjectId, ref: 'Hospital', required: true, index: true },
    labTestId: { type: mongoose_1.Schema.Types.ObjectId, ref: 'LabTest', required: true, unique: true, index: true },
    patientId: { type: mongoose_1.Schema.Types.ObjectId, ref: 'Patient', required: true, index: true },
    parameters: [{
            name: { type: String, required: true },
            value: { type: String, required: true },
            unit: { type: String, required: true },
            referenceRange: String,
            isAbnormal: { type: Boolean, default: false }
        }],
    uploadedBy: { type: mongoose_1.Schema.Types.ObjectId, ref: 'User', required: true },
    approvedBy: { type: mongoose_1.Schema.Types.ObjectId, ref: 'User' },
    reportFileUrl: String
}, { timestamps: true });
exports.LabReport = mongoose_1.default.model('LabReport', LabReportSchema);
