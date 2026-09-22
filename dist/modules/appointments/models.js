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
exports.Queue = exports.Appointment = void 0;
const mongoose_1 = __importStar(require("mongoose"));
const AppointmentSchema = new mongoose_1.Schema({
    hospitalId: { type: mongoose_1.Schema.Types.ObjectId, ref: 'Hospital', required: true, index: true },
    patientId: { type: mongoose_1.Schema.Types.ObjectId, ref: 'Patient', required: true, index: true },
    doctorId: { type: mongoose_1.Schema.Types.ObjectId, ref: 'Doctor', required: true, index: true },
    scheduledDate: { type: Date, required: true, index: true },
    startTime: { type: String, required: true },
    endTime: { type: String, required: true },
    status: {
        type: String,
        enum: ['Scheduled', 'In-Progress', 'Completed', 'Cancelled', 'No-Show'],
        default: 'Scheduled',
        index: true
    },
    type: {
        type: String,
        enum: ['OPD', 'IPD', 'Follow-up', 'Emergency'],
        default: 'OPD'
    },
    notes: String,
    cancellationReason: String
}, { timestamps: true });
exports.Appointment = mongoose_1.default.model('Appointment', AppointmentSchema);
const QueueSchema = new mongoose_1.Schema({
    hospitalId: { type: mongoose_1.Schema.Types.ObjectId, ref: 'Hospital', required: true, index: true },
    doctorId: { type: mongoose_1.Schema.Types.ObjectId, ref: 'Doctor', required: true, index: true },
    date: { type: Date, required: true, index: true },
    activeQueue: [{
            appointmentId: { type: mongoose_1.Schema.Types.ObjectId, ref: 'Appointment', required: true },
            patientId: { type: mongoose_1.Schema.Types.ObjectId, ref: 'Patient', required: true },
            tokenNumber: { type: Number, required: true },
            status: {
                type: String,
                enum: ['Waiting', 'Called', 'In-Consultation', 'Completed', 'Skipped'],
                default: 'Waiting'
            }
        }]
}, { timestamps: true });
exports.Queue = mongoose_1.default.model('Queue', QueueSchema);
