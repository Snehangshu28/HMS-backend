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
exports.MedicineSale = exports.Medicine = void 0;
const mongoose_1 = __importStar(require("mongoose"));
const MedicineSchema = new mongoose_1.Schema({
    hospitalId: { type: mongoose_1.Schema.Types.ObjectId, ref: 'Hospital', required: true, index: true },
    name: { type: String, required: true },
    genericName: String,
    category: { type: String, required: true },
    sku: { type: String, required: true, index: true },
    manufacturer: String,
    price: {
        purchasePrice: { type: Number, required: true },
        salesPrice: { type: Number, required: true }
    },
    stock: { type: Number, default: 0 },
    reorderLevel: { type: Number, default: 20 },
    batches: [{
            batchNumber: { type: String, required: true },
            expiryDate: { type: Date, required: true, index: true },
            quantity: { type: Number, required: true }
        }]
}, { timestamps: true });
exports.Medicine = mongoose_1.default.model('Medicine', MedicineSchema);
const MedicineSaleSchema = new mongoose_1.Schema({
    hospitalId: { type: mongoose_1.Schema.Types.ObjectId, ref: 'Hospital', required: true, index: true },
    prescriptionId: { type: mongoose_1.Schema.Types.ObjectId, ref: 'Prescription' },
    patientId: { type: mongoose_1.Schema.Types.ObjectId, ref: 'Patient' },
    items: [{
            medicineId: { type: mongoose_1.Schema.Types.ObjectId, ref: 'Medicine', required: true },
            quantity: { type: Number, required: true },
            unitPrice: { type: Number, required: true },
            totalPrice: { type: Number, required: true }
        }],
    subtotal: { type: Number, required: true },
    tax: { type: Number, required: true },
    grandTotal: { type: Number, required: true },
    paymentMode: { type: String, enum: ['Cash', 'UPI', 'Card'], required: true },
    soldBy: { type: mongoose_1.Schema.Types.ObjectId, ref: 'User', required: true }
}, { timestamps: true });
exports.MedicineSale = mongoose_1.default.model('MedicineSale', MedicineSaleSchema);
