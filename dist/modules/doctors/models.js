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
exports.DoctorSchedule = exports.Doctor = void 0;
const mongoose_1 = __importStar(require("mongoose"));
const DoctorSchema = new mongoose_1.Schema({
    hospitalId: { type: mongoose_1.Schema.Types.ObjectId, ref: 'Hospital', required: true, index: true },
    userId: { type: mongoose_1.Schema.Types.ObjectId, ref: 'User', required: true, unique: true, index: true },
    licenseNumber: { type: String, required: true },
    specialization: [{ type: String, required: true }],
    qualification: [{ type: String, required: true }],
    experienceYears: { type: Number, required: true },
    consultationFee: { type: Number, required: true },
    isAvailable: { type: Boolean, default: true }
}, { timestamps: true });
exports.Doctor = mongoose_1.default.model('Doctor', DoctorSchema);
const DoctorScheduleSchema = new mongoose_1.Schema({
    hospitalId: { type: mongoose_1.Schema.Types.ObjectId, ref: 'Hospital', required: true, index: true },
    doctorId: { type: mongoose_1.Schema.Types.ObjectId, ref: 'Doctor', required: true, index: true },
    weeklySlots: [{
            dayOfWeek: {
                type: String,
                enum: ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'],
                required: true
            },
            startTime: { type: String, required: true },
            endTime: { type: String, required: true },
            slotDuration: { type: Number, default: 15 }
        }],
    exceptions: [{
            date: { type: Date, required: true },
            isAvailable: { type: Boolean, default: false }
        }]
}, { timestamps: true });
exports.DoctorSchedule = mongoose_1.default.model('DoctorSchedule', DoctorScheduleSchema);
