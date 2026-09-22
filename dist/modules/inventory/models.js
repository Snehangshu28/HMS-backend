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
exports.Vendor = exports.InventoryItem = void 0;
const mongoose_1 = __importStar(require("mongoose"));
const InventoryItemSchema = new mongoose_1.Schema({
    hospitalId: { type: mongoose_1.Schema.Types.ObjectId, ref: 'Hospital', required: true, index: true },
    name: { type: String, required: true },
    sku: { type: String, required: true, index: true },
    category: {
        type: String,
        enum: ['Surgical Instrument', 'Diagnostic Equipment', 'PPE', 'Office Supply'],
        required: true
    },
    quantity: { type: Number, required: true, default: 0 },
    reorderLevel: { type: Number, default: 5 },
    status: {
        type: String,
        enum: ['Good', 'Under Maintenance', 'Broken'],
        default: 'Good'
    },
    vendorId: { type: mongoose_1.Schema.Types.ObjectId, ref: 'Vendor' }
}, { timestamps: true });
exports.InventoryItem = mongoose_1.default.model('InventoryItem', InventoryItemSchema);
const VendorSchema = new mongoose_1.Schema({
    hospitalId: { type: mongoose_1.Schema.Types.ObjectId, ref: 'Hospital', required: true, index: true },
    name: { type: String, required: true },
    contactPerson: String,
    phone: String,
    email: String,
    address: String
}, { timestamps: true });
exports.Vendor = mongoose_1.default.model('Vendor', VendorSchema);
