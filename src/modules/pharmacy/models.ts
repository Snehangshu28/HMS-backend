import mongoose, { Schema, Document } from 'mongoose';

export interface IMedicine extends Document {
  hospitalId: mongoose.Types.ObjectId;
  name: string;
  genericName?: string;
  category: string;
  sku: string;
  manufacturer?: string;
  price: {
    purchasePrice: number;
    salesPrice: number;
  };
  stock: number;
  reorderLevel: number;
  batches: {
    batchNumber: string;
    expiryDate: Date;
    quantity: number;
  }[];
}

const MedicineSchema = new Schema<IMedicine>({
  hospitalId: { type: Schema.Types.ObjectId, ref: 'Hospital', required: true, index: true },
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

export const Medicine = mongoose.model<IMedicine>('Medicine', MedicineSchema);

// Medicine Sales Model (Prescription dispensing checkouts)
export interface IMedicineSale extends Document {
  hospitalId: mongoose.Types.ObjectId;
  prescriptionId?: mongoose.Types.ObjectId;
  patientId?: mongoose.Types.ObjectId;
  items: {
    medicineId: mongoose.Types.ObjectId;
    quantity: number;
    unitPrice: number;
    totalPrice: number;
  }[];
  subtotal: number;
  tax: number;
  grandTotal: number;
  paymentMode: 'Cash' | 'UPI' | 'Card';
  soldBy: mongoose.Types.ObjectId;
  createdAt: Date;
}

const MedicineSaleSchema = new Schema<IMedicineSale>({
  hospitalId: { type: Schema.Types.ObjectId, ref: 'Hospital', required: true, index: true },
  prescriptionId: { type: Schema.Types.ObjectId, ref: 'Prescription' },
  patientId: { type: Schema.Types.ObjectId, ref: 'Patient' },
  items: [{
    medicineId: { type: Schema.Types.ObjectId, ref: 'Medicine', required: true },
    quantity: { type: Number, required: true },
    unitPrice: { type: Number, required: true },
    totalPrice: { type: Number, required: true }
  }],
  subtotal: { type: Number, required: true },
  tax: { type: Number, required: true },
  grandTotal: { type: Number, required: true },
  paymentMode: { type: String, enum: ['Cash', 'UPI', 'Card'], required: true },
  soldBy: { type: Schema.Types.ObjectId, ref: 'User', required: true }
}, { timestamps: true });

export const MedicineSale = mongoose.model<IMedicineSale>('MedicineSale', MedicineSaleSchema);
