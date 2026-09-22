import mongoose, { Schema, Document } from 'mongoose';

export interface IInvoice extends Document {
  hospitalId: mongoose.Types.ObjectId;
  invoiceNumber: string;
  patientId: mongoose.Types.ObjectId;
  items: {
    description: string;
    category: 'Consultation' | 'Lab Test' | 'Pharmacy' | 'IPD Ward' | 'ICU Bed' | 'Other';
    quantity: number;
    unitPrice: number;
    taxRate: number;
    taxAmount: number;
    totalPrice: number;
  }[];
  subtotal: number;
  taxTotal: number;
  discountAmount: number;
  grandTotal: number;
  paymentStatus: 'Unpaid' | 'Partially-Paid' | 'Paid' | 'Refunded';
  dueDate: Date;
  isGstCompliant: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const InvoiceSchema = new Schema<IInvoice>({
  hospitalId: { type: Schema.Types.ObjectId, ref: 'Hospital', required: true, index: true },
  invoiceNumber: { type: String, unique: true, index: true },
  patientId: { type: Schema.Types.ObjectId, ref: 'Patient', required: true, index: true },
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

InvoiceSchema.pre<IInvoice>('validate', async function (next) {
  if (this.isNew && !this.invoiceNumber) {
    const count = await mongoose.model('Invoice').countDocuments({ hospitalId: this.hospitalId });
    this.invoiceNumber = `INV-${new Date().getFullYear()}-${(count + 10001).toString()}`;
  }
  next();
});

export const Invoice = mongoose.model<IInvoice>('Invoice', InvoiceSchema);

// Payment Model
export interface IPayment extends Document {
  hospitalId: mongoose.Types.ObjectId;
  invoiceId: mongoose.Types.ObjectId;
  paymentNumber: string;
  amount: number;
  paymentMethod: 'Cash' | 'UPI' | 'Card' | 'Bank Transfer' | 'Insurance';
  transactionId?: string;
  status: 'Success' | 'Pending' | 'Failed';
  timestamp: Date;
}

const PaymentSchema = new Schema<IPayment>({
  hospitalId: { type: Schema.Types.ObjectId, ref: 'Hospital', required: true, index: true },
  invoiceId: { type: Schema.Types.ObjectId, ref: 'Invoice', required: true, index: true },
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

export const Payment = mongoose.model<IPayment>('Payment', PaymentSchema);

// Insurance Claim Model
export interface IInsuranceClaim extends Document {
  hospitalId: mongoose.Types.ObjectId;
  invoiceId: mongoose.Types.ObjectId;
  patientId: mongoose.Types.ObjectId;
  provider: string;
  policyNumber: string;
  preAuthNumber?: string;
  claimedAmount: number;
  approvedAmount?: number;
  status: 'Pre-Auth Pending' | 'Pre-Auth Approved' | 'Claim Submitted' | 'Settled' | 'Rejected';
}

const InsuranceClaimSchema = new Schema<IInsuranceClaim>({
  hospitalId: { type: Schema.Types.ObjectId, ref: 'Hospital', required: true, index: true },
  invoiceId: { type: Schema.Types.ObjectId, ref: 'Invoice', required: true, index: true },
  patientId: { type: Schema.Types.ObjectId, ref: 'Patient', required: true, index: true },
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

export const InsuranceClaim = mongoose.model<IInsuranceClaim>('InsuranceClaim', InsuranceClaimSchema);
