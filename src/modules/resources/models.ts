import mongoose, { Schema, Document } from 'mongoose';

/** Running ledger of all resources used for an admission — created on admit */
export interface IPatientResourceLedger extends Document {
  hospitalId: mongoose.Types.ObjectId;
  admissionId: mongoose.Types.ObjectId;
  patientId: mongoose.Types.ObjectId;
  status: 'Open' | 'Closed';
  totalItems: number;
  totalAmount: number;
  closedAt?: Date;
}

const PatientResourceLedgerSchema = new Schema<IPatientResourceLedger>(
  {
    hospitalId: { type: Schema.Types.ObjectId, ref: 'Hospital', required: true, index: true },
    admissionId: { type: Schema.Types.ObjectId, ref: 'Admission', required: true, unique: true },
    patientId: { type: Schema.Types.ObjectId, ref: 'Patient', required: true, index: true },
    status: { type: String, enum: ['Open', 'Closed'], default: 'Open', index: true },
    totalItems: { type: Number, default: 0 },
    totalAmount: { type: Number, default: 0 },
    closedAt: Date,
  },
  { timestamps: true }
);

export const PatientResourceLedger = mongoose.model<IPatientResourceLedger>(
  'PatientResourceLedger',
  PatientResourceLedgerSchema
);

/** Single resource consumption / charge event linked to a patient */
export interface IResourceUsage extends Document {
  hospitalId: mongoose.Types.ObjectId;
  ledgerId: mongoose.Types.ObjectId;
  admissionId?: mongoose.Types.ObjectId;
  patientId: mongoose.Types.ObjectId;
  source: 'SCAN' | 'TEMPLATE' | 'PHARMACY' | 'LAB' | 'BED' | 'MANUAL';
  itemId?: mongoose.Types.ObjectId;
  itemName: string;
  barcode?: string;
  batchNumber?: string;
  quantity: number;
  unitPrice: number;
  totalPrice: number;
  storeId?: mongoose.Types.ObjectId;
  templateId?: mongoose.Types.ObjectId;
  templateName?: string;
  billed: boolean;
  invoiceId?: mongoose.Types.ObjectId;
  stockTransactionIds?: mongoose.Types.ObjectId[];
  performedBy?: mongoose.Types.ObjectId;
  remarks?: string;
}

const ResourceUsageSchema = new Schema<IResourceUsage>(
  {
    hospitalId: { type: Schema.Types.ObjectId, ref: 'Hospital', required: true, index: true },
    ledgerId: { type: Schema.Types.ObjectId, ref: 'PatientResourceLedger', required: true, index: true },
    admissionId: { type: Schema.Types.ObjectId, ref: 'Admission', index: true },
    patientId: { type: Schema.Types.ObjectId, ref: 'Patient', required: true, index: true },
    source: {
      type: String,
      enum: ['SCAN', 'TEMPLATE', 'PHARMACY', 'LAB', 'BED', 'MANUAL'],
      required: true,
      index: true,
    },
    itemId: { type: Schema.Types.ObjectId, ref: 'CatalogItem' },
    itemName: { type: String, required: true },
    barcode: String,
    batchNumber: String,
    quantity: { type: Number, required: true },
    unitPrice: { type: Number, required: true },
    totalPrice: { type: Number, required: true },
    storeId: { type: Schema.Types.ObjectId, ref: 'InventoryStore' },
    templateId: { type: Schema.Types.ObjectId, ref: 'ProcedureTemplate' },
    templateName: String,
    billed: { type: Boolean, default: true, index: true },
    invoiceId: { type: Schema.Types.ObjectId, ref: 'Invoice' },
    stockTransactionIds: [{ type: Schema.Types.ObjectId, ref: 'StockTransaction' }],
    performedBy: { type: Schema.Types.ObjectId, ref: 'User' },
    remarks: String,
  },
  { timestamps: true }
);

ResourceUsageSchema.index({ hospitalId: 1, createdAt: -1 });
ResourceUsageSchema.index({ hospitalId: 1, billed: 1, source: 1 });

export const ResourceUsage = mongoose.model<IResourceUsage>('ResourceUsage', ResourceUsageSchema);

/** One-tap procedure kits — auto-consume + bill a set of items */
export interface IProcedureTemplate extends Document {
  hospitalId: mongoose.Types.ObjectId;
  code: string;
  name: string;
  description?: string;
  category:
    | 'Nursing'
    | 'OT'
    | 'Emergency'
    | 'ICU'
    | 'Maternity'
    | 'Other';
  items: {
    itemId: mongoose.Types.ObjectId;
    quantity: number;
    isOptional?: boolean;
  }[];
  isActive: boolean;
  createdBy?: mongoose.Types.ObjectId;
}

const ProcedureTemplateSchema = new Schema<IProcedureTemplate>(
  {
    hospitalId: { type: Schema.Types.ObjectId, ref: 'Hospital', required: true, index: true },
    code: { type: String, required: true },
    name: { type: String, required: true },
    description: String,
    category: {
      type: String,
      enum: ['Nursing', 'OT', 'Emergency', 'ICU', 'Maternity', 'Other'],
      default: 'Nursing',
    },
    items: [
      {
        itemId: { type: Schema.Types.ObjectId, ref: 'CatalogItem', required: true },
        quantity: { type: Number, required: true, min: 1 },
        isOptional: { type: Boolean, default: false },
      },
    ],
    isActive: { type: Boolean, default: true },
    createdBy: { type: Schema.Types.ObjectId, ref: 'User' },
  },
  { timestamps: true }
);

ProcedureTemplateSchema.index({ hospitalId: 1, code: 1 }, { unique: true });

export const ProcedureTemplate = mongoose.model<IProcedureTemplate>(
  'ProcedureTemplate',
  ProcedureTemplateSchema
);

/** Configurable daily bed / admission fees by ward category */
export interface IBedChargeRate extends Document {
  hospitalId: mongoose.Types.ObjectId;
  wardCategory: 'General' | 'ICU' | 'Emergency' | 'Pediatric' | 'Maternity';
  bedType?: 'General' | 'Semi-Private' | 'Private' | 'ICU' | 'NICU';
  dailyRate: number;
  admissionFee: number;
  billCategory: 'IPD Ward' | 'ICU Bed';
  isActive: boolean;
}

const BedChargeRateSchema = new Schema<IBedChargeRate>(
  {
    hospitalId: { type: Schema.Types.ObjectId, ref: 'Hospital', required: true, index: true },
    wardCategory: {
      type: String,
      enum: ['General', 'ICU', 'Emergency', 'Pediatric', 'Maternity'],
      required: true,
    },
    bedType: {
      type: String,
      enum: ['General', 'Semi-Private', 'Private', 'ICU', 'NICU'],
    },
    dailyRate: { type: Number, required: true },
    admissionFee: { type: Number, required: true },
    billCategory: { type: String, enum: ['IPD Ward', 'ICU Bed'], default: 'IPD Ward' },
    isActive: { type: Boolean, default: true },
  },
  { timestamps: true }
);

BedChargeRateSchema.index({ hospitalId: 1, wardCategory: 1, bedType: 1 }, { unique: true });

export const BedChargeRate = mongoose.model<IBedChargeRate>('BedChargeRate', BedChargeRateSchema);

/** Ward consumption vs patient billing mismatch alerts */
export interface IReconciliationAlert extends Document {
  hospitalId: mongoose.Types.ObjectId;
  type: 'UNBILLED_CONSUMPTION' | 'BILL_WITHOUT_STOCK' | 'QTY_MISMATCH';
  severity: 'Low' | 'Medium' | 'High';
  patientId?: mongoose.Types.ObjectId;
  admissionId?: mongoose.Types.ObjectId;
  itemId?: mongoose.Types.ObjectId;
  itemName?: string;
  consumedQty?: number;
  billedQty?: number;
  amount?: number;
  message: string;
  status: 'Open' | 'Resolved' | 'Ignored';
  resolvedBy?: mongoose.Types.ObjectId;
  resolvedAt?: Date;
}

const ReconciliationAlertSchema = new Schema<IReconciliationAlert>(
  {
    hospitalId: { type: Schema.Types.ObjectId, ref: 'Hospital', required: true, index: true },
    type: {
      type: String,
      enum: ['UNBILLED_CONSUMPTION', 'BILL_WITHOUT_STOCK', 'QTY_MISMATCH'],
      required: true,
    },
    severity: { type: String, enum: ['Low', 'Medium', 'High'], default: 'Medium' },
    patientId: { type: Schema.Types.ObjectId, ref: 'Patient' },
    admissionId: { type: Schema.Types.ObjectId, ref: 'Admission' },
    itemId: { type: Schema.Types.ObjectId, ref: 'CatalogItem' },
    itemName: String,
    consumedQty: Number,
    billedQty: Number,
    amount: Number,
    message: { type: String, required: true },
    status: { type: String, enum: ['Open', 'Resolved', 'Ignored'], default: 'Open', index: true },
    resolvedBy: { type: Schema.Types.ObjectId, ref: 'User' },
    resolvedAt: Date,
  },
  { timestamps: true }
);

export const ReconciliationAlert = mongoose.model<IReconciliationAlert>(
  'ReconciliationAlert',
  ReconciliationAlertSchema
);

/** Default procedure kit definitions (seeded when hospital has none) */
export const DEFAULT_PROCEDURE_TEMPLATES = [
  {
    code: 'IV-CANNULATION',
    name: 'IV Cannulation',
    category: 'Nursing' as const,
    description: 'Peripheral IV cannula insertion kit',
    items: [
      { nameHint: 'Cannula', quantity: 1 },
      { nameHint: 'IV Set', quantity: 1 },
      { nameHint: 'Syringe', quantity: 1 },
      { nameHint: 'Gloves', quantity: 2 },
      { nameHint: 'Dressing', quantity: 1 },
    ],
  },
  {
    code: 'DRESSING',
    name: 'Wound Dressing',
    category: 'Nursing' as const,
    description: 'Standard wound dressing kit',
    items: [
      { nameHint: 'Dressing', quantity: 1 },
      { nameHint: 'Gloves', quantity: 2 },
      { nameHint: 'Gauze', quantity: 2 },
    ],
  },
  {
    code: 'FOLEY',
    name: 'Foley Catheter Insertion',
    category: 'Nursing' as const,
    description: 'Urinary catheter insertion kit',
    items: [
      { nameHint: 'Foley', quantity: 1 },
      { nameHint: 'Gloves', quantity: 2 },
      { nameHint: 'Lubricant', quantity: 1 },
      { nameHint: 'Syringe', quantity: 1 },
    ],
  },
  {
    code: 'NEBULIZATION',
    name: 'Nebulization',
    category: 'Nursing' as const,
    description: 'Nebulizer therapy kit',
    items: [
      { nameHint: 'Nebulizer', quantity: 1 },
      { nameHint: 'Mask', quantity: 1 },
    ],
  },
  {
    code: 'BLOOD-TX',
    name: 'Blood Transfusion',
    category: 'ICU' as const,
    description: 'Blood transfusion consumables',
    items: [
      { nameHint: 'Blood Set', quantity: 1 },
      { nameHint: 'Gloves', quantity: 2 },
      { nameHint: 'IV Set', quantity: 1 },
    ],
  },
  {
    code: 'MINOR-PROC',
    name: 'Minor Procedure',
    category: 'OT' as const,
    description: 'Minor OT / procedure room kit',
    items: [
      { nameHint: 'Gloves', quantity: 4 },
      { nameHint: 'Syringe', quantity: 2 },
      { nameHint: 'Dressing', quantity: 2 },
      { nameHint: 'Gauze', quantity: 4 },
    ],
  },
  {
    code: 'MAJOR-OT',
    name: 'Major OT Procedure',
    category: 'OT' as const,
    description: 'Major operating theatre consumable kit',
    items: [
      { nameHint: 'Gloves', quantity: 10 },
      { nameHint: 'Suture', quantity: 2 },
      { nameHint: 'Dressing', quantity: 4 },
      { nameHint: 'Gauze', quantity: 10 },
      { nameHint: 'Syringe', quantity: 4 },
    ],
  },
];

export const DEFAULT_BED_RATES: Omit<
  IBedChargeRate,
  keyof Document | 'hospitalId' | 'isActive'
>[] = [
  { wardCategory: 'General', dailyRate: 2500, admissionFee: 800, billCategory: 'IPD Ward' },
  { wardCategory: 'ICU', dailyRate: 5000, admissionFee: 1500, billCategory: 'ICU Bed' },
  { wardCategory: 'Emergency', dailyRate: 3500, admissionFee: 1000, billCategory: 'IPD Ward' },
  { wardCategory: 'Pediatric', dailyRate: 2800, admissionFee: 1000, billCategory: 'IPD Ward' },
  { wardCategory: 'Maternity', dailyRate: 2800, admissionFee: 1000, billCategory: 'IPD Ward' },
];
