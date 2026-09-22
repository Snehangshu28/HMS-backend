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
exports.InsuranceClaim = exports.Payment = exports.Invoice = void 0;
const mongoose_1 = __importStar(require("mongoose"));
const InvoiceSchema = new mongoose_1.Schema({
    hospitalId: { type: mongoose_1.Schema.Types.ObjectId, ref: 'Hospital', required: true, index: true },
    invoiceNumber: { type: String, unique: true, index: true },
    patientId: { type: mongoose_1.Schema.Types.ObjectId, ref: 'Patient', required: true, index: true },
    items: [{
            description: { type: String, required: true },
            category: {
                type: String,
                enum: ['Consultation', 'Lab Test', 'Pharmacy', 'IPD Ward', 'ICU Bed', 'Other'],
                required: true
            },
            quantity: { type: Number, required: true, default: 1 },
            unitPrice: { type: Number, required: true },
            taxRate: { type: Number, default: 0 },
            taxAmount: { type: Number, required: true, default: 0 },
            totalPrice: { type: Number, required: true }
        }],
    subtotal: { type: Number, required: true },
    taxTotal: { type: Number, required: true },
    discountAmount: { type: Number, default: 0 },
    grandTotal: { type: Number, required: true },
    paymentStatus: {
        type: String,
        enum: ['Unpaid', 'Partially-Paid', 'Paid', 'Refunded'],
        default: 'Unpaid',
        index: true
    },
    dueDate: { type: Date, required: true },
    isGstCompliant: { type: Boolean, default: true }
}, { timestamps: true });
InvoiceSchema.pre('validate', async function (next) {
    if (this.isNew && !this.invoiceNumber) {
        const count = await mongoose_1.default.model('Invoice').countDocuments({ hospitalId: this.hospitalId });
        this.invoiceNumber = `INV-${new Date().getFullYear()}-${(count + 10001).toString()}`;
    }
    next();
});
exports.Invoice = mongoose_1.default.model('Invoice', InvoiceSchema);
const PaymentSchema = new mongoose_1.Schema({
    hospitalId: { type: mongoose_1.Schema.Types.ObjectId, ref: 'Hospital', required: true, index: true },
    invoiceId: { type: mongoose_1.Schema.Types.ObjectId, ref: 'Invoice', required: true, index: true },
    paymentNumber: { type: String, required: true },
    amount: { type: Number, required: true },
    paymentMethod: {
        type: String,
        enum: ['Cash', 'UPI', 'Card', 'Bank Transfer', 'Insurance'],
        required: true
    },
    transactionId: String,
    status: {
        type: String,
        enum: ['Success', 'Pending', 'Failed'],
        default: 'Success'
    },
    timestamp: { type: Date, default: Date.now }
}, { timestamps: true });
exports.Payment = mongoose_1.default.model('Payment', PaymentSchema);
const InsuranceClaimSchema = new mongoose_1.Schema({
    hospitalId: { type: mongoose_1.Schema.Types.ObjectId, ref: 'Hospital', required: true, index: true },
    invoiceId: { type: mongoose_1.Schema.Types.ObjectId, ref: 'Invoice', required: true, index: true },
    patientId: { type: mongoose_1.Schema.Types.ObjectId, ref: 'Patient', required: true, index: true },
    provider: { type: String, required: true },
    policyNumber: { type: String, required: true },
    preAuthNumber: String,
    claimedAmount: { type: Number, required: true },
    approvedAmount: Number,
    status: {
        type: String,
        enum: ['Pre-Auth Pending', 'Pre-Auth Approved', 'Claim Submitted', 'Settled', 'Rejected'],
        default: 'Pre-Auth Pending'
    }
}, { timestamps: true });
exports.InsuranceClaim = mongoose_1.default.model('InsuranceClaim', InsuranceClaimSchema);
