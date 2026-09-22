import mongoose, { Schema, Document } from 'mongoose';

/* ───────── Legacy simple inventory (kept for backward compatibility) ───────── */
export interface IInventoryItem extends Document {
  hospitalId: mongoose.Types.ObjectId;
  name: string;
  sku: string;
  category: 'Surgical Instrument' | 'Diagnostic Equipment' | 'PPE' | 'Office Supply';
  quantity: number;
  reorderLevel: number;
  status: 'Good' | 'Under Maintenance' | 'Broken';
  vendorId?: mongoose.Types.ObjectId;
}

const InventoryItemSchema = new Schema<IInventoryItem>(
  {
    hospitalId: { type: Schema.Types.ObjectId, ref: 'Hospital', required: true, index: true },
    name: { type: String, required: true },
    sku: { type: String, required: true, index: true },
    category: {
      type: String,
      enum: ['Surgical Instrument', 'Diagnostic Equipment', 'PPE', 'Office Supply'],
      required: true,
    },
    quantity: { type: Number, required: true, default: 0 },
    reorderLevel: { type: Number, default: 5 },
    status: {
      type: String,
      enum: ['Good', 'Under Maintenance', 'Broken'],
      default: 'Good',
    },
    vendorId: { type: Schema.Types.ObjectId, ref: 'Vendor' },
  },
  { timestamps: true }
);

export const InventoryItem = mongoose.model<IInventoryItem>('InventoryItem', InventoryItemSchema);

/* ───────── Vendors ───────── */
export interface IVendor extends Document {
  hospitalId: mongoose.Types.ObjectId;
  name: string;
  contactPerson?: string;
  phone?: string;
  email?: string;
  address?: string;
  gstNumber?: string;
  paymentTerms?: string;
  isActive: boolean;
}

const VendorSchema = new Schema<IVendor>(
  {
    hospitalId: { type: Schema.Types.ObjectId, ref: 'Hospital', required: true, index: true },
    name: { type: String, required: true },
    contactPerson: String,
    phone: String,
    email: String,
    address: String,
    gstNumber: String,
    paymentTerms: String,
    isActive: { type: Boolean, default: true },
  },
  { timestamps: true }
);

export const Vendor = mongoose.model<IVendor>('Vendor', VendorSchema);

/* ───────── Smart inventory collections ───────── */

export interface IInventoryCategory extends Document {
  hospitalId: mongoose.Types.ObjectId;
  name: string;
  parentCategory?: mongoose.Types.ObjectId;
  description?: string;
}

const InventoryCategorySchema = new Schema<IInventoryCategory>(
  {
    hospitalId: { type: Schema.Types.ObjectId, ref: 'Hospital', required: true, index: true },
    name: { type: String, required: true },
    parentCategory: { type: Schema.Types.ObjectId, ref: 'InventoryCategory' },
    description: String,
  },
  { timestamps: true, collection: 'inventory_categories' }
);

export const InventoryCategory = mongoose.model<IInventoryCategory>(
  'InventoryCategory',
  InventoryCategorySchema
);

export type StoreType =
  | 'Main Warehouse'
  | 'Pharmacy'
  | 'Operation Theater'
  | 'ICU'
  | 'Emergency'
  | 'General Ward'
  | 'Laboratory'
  | 'Radiology'
  | 'CSSD'
  | 'Custom';

export interface IInventoryStore extends Document {
  hospitalId: mongoose.Types.ObjectId;
  name: string;
  type: StoreType;
  location?: string;
  managerId?: mongoose.Types.ObjectId;
  isActive: boolean;
}

const InventoryStoreSchema = new Schema<IInventoryStore>(
  {
    hospitalId: { type: Schema.Types.ObjectId, ref: 'Hospital', required: true, index: true },
    name: { type: String, required: true },
    type: {
      type: String,
      enum: [
        'Main Warehouse',
        'Pharmacy',
        'Operation Theater',
        'ICU',
        'Emergency',
        'General Ward',
        'Laboratory',
        'Radiology',
        'CSSD',
        'Custom',
      ],
      required: true,
    },
    location: String,
    managerId: { type: Schema.Types.ObjectId, ref: 'User' },
    isActive: { type: Boolean, default: true },
  },
  { timestamps: true, collection: 'inventory_stores' }
);

InventoryStoreSchema.index({ hospitalId: 1, name: 1 }, { unique: true });
export const InventoryStore = mongoose.model<IInventoryStore>('InventoryStore', InventoryStoreSchema);

export interface ICatalogItem extends Document {
  hospitalId: mongoose.Types.ObjectId;
  itemCode: string;
  barcode?: string;
  name: string;
  genericName?: string;
  categoryId?: mongoose.Types.ObjectId;
  unit: string;
  reorderLevel: number;
  reorderQuantity: number;
  safetyStock: number;
  maxStock?: number;
  hsnCode?: string;
  gstRate: number;
  manufacturer?: string;
  isBatchTracked: boolean;
  isExpiryTracked: boolean;
  sellingPrice: number;
  isActive: boolean;
  createdBy?: mongoose.Types.ObjectId;
}

const CatalogItemSchema = new Schema<ICatalogItem>(
  {
    hospitalId: { type: Schema.Types.ObjectId, ref: 'Hospital', required: true, index: true },
    itemCode: { type: String, required: true, index: true },
    barcode: { type: String, index: true },
    name: { type: String, required: true, index: true },
    genericName: String,
    categoryId: { type: Schema.Types.ObjectId, ref: 'InventoryCategory' },
    unit: { type: String, default: 'pcs' },
    reorderLevel: { type: Number, default: 10 },
    reorderQuantity: { type: Number, default: 50 },
    safetyStock: { type: Number, default: 5 },
    maxStock: Number,
    hsnCode: String,
    gstRate: { type: Number, default: 0 },
    manufacturer: String,
    isBatchTracked: { type: Boolean, default: true },
    isExpiryTracked: { type: Boolean, default: true },
    sellingPrice: { type: Number, default: 0 },
    isActive: { type: Boolean, default: true },
    createdBy: { type: Schema.Types.ObjectId, ref: 'User' },
  },
  { timestamps: true, collection: 'inventory_items' }
);

CatalogItemSchema.index({ hospitalId: 1, itemCode: 1 }, { unique: true });
CatalogItemSchema.index(
  { hospitalId: 1, barcode: 1 },
  { unique: true, sparse: true, partialFilterExpression: { barcode: { $type: 'string' } } }
);
export const CatalogItem = mongoose.model<ICatalogItem>('CatalogItem', CatalogItemSchema);

export interface IInventoryBatch extends Document {
  hospitalId: mongoose.Types.ObjectId;
  itemId: mongoose.Types.ObjectId;
  storeId: mongoose.Types.ObjectId;
  /** Manufacturer barcode mirrored from catalog item */
  barcode?: string;
  batchNumber: string;
  expiryDate?: Date;
  manufactureDate?: Date;
  purchasePrice: number;
  sellingPrice: number;
  mrp: number;
  quantity: number;
  quantityReceived?: number;
  reservedQuantity: number;
  availableQuantity: number;
  vendorId?: mongoose.Types.ObjectId;
}

const InventoryBatchSchema = new Schema<IInventoryBatch>(
  {
    hospitalId: { type: Schema.Types.ObjectId, ref: 'Hospital', required: true, index: true },
    itemId: { type: Schema.Types.ObjectId, ref: 'CatalogItem', required: true, index: true },
    storeId: { type: Schema.Types.ObjectId, ref: 'InventoryStore', required: true, index: true },
    barcode: { type: String, index: true },
    batchNumber: { type: String, required: true },
    expiryDate: { type: Date, index: true },
    manufactureDate: Date,
    purchasePrice: { type: Number, default: 0 },
    sellingPrice: { type: Number, default: 0 },
    mrp: { type: Number, default: 0 },
    quantity: { type: Number, default: 0 },
    quantityReceived: { type: Number, default: 0 },
    reservedQuantity: { type: Number, default: 0 },
    availableQuantity: { type: Number, default: 0, index: true },
    vendorId: { type: Schema.Types.ObjectId, ref: 'Vendor' },
  },
  { timestamps: true, collection: 'inventory_batches' }
);

InventoryBatchSchema.index({ hospitalId: 1, itemId: 1, storeId: 1, batchNumber: 1 });
export const InventoryBatch = mongoose.model<IInventoryBatch>('InventoryBatch', InventoryBatchSchema);

export type StockTxnType =
  | 'PURCHASE'
  | 'TRANSFER'
  | 'CONSUMPTION'
  | 'RETURN'
  | 'DAMAGE'
  | 'EXPIRED'
  | 'ADJUSTMENT'
  | 'OPENING_STOCK';

export interface IStockTransaction extends Document {
  hospitalId: mongoose.Types.ObjectId;
  itemId: mongoose.Types.ObjectId;
  batchId?: mongoose.Types.ObjectId;
  fromStoreId?: mongoose.Types.ObjectId;
  toStoreId?: mongoose.Types.ObjectId;
  transactionType: StockTxnType;
  quantity: number;
  unitCost: number;
  referenceType?: string;
  referenceId?: string;
  patientId?: mongoose.Types.ObjectId;
  admissionId?: mongoose.Types.ObjectId;
  departmentId?: string;
  remarks?: string;
  performedBy?: mongoose.Types.ObjectId;
}

const StockTransactionSchema = new Schema<IStockTransaction>(
  {
    hospitalId: { type: Schema.Types.ObjectId, ref: 'Hospital', required: true, index: true },
    itemId: { type: Schema.Types.ObjectId, ref: 'CatalogItem', required: true, index: true },
    batchId: { type: Schema.Types.ObjectId, ref: 'InventoryBatch', index: true },
    fromStoreId: { type: Schema.Types.ObjectId, ref: 'InventoryStore' },
    toStoreId: { type: Schema.Types.ObjectId, ref: 'InventoryStore' },
    transactionType: {
      type: String,
      enum: ['PURCHASE', 'TRANSFER', 'CONSUMPTION', 'RETURN', 'DAMAGE', 'EXPIRED', 'ADJUSTMENT', 'OPENING_STOCK'],
      required: true,
      index: true,
    },
    quantity: { type: Number, required: true },
    unitCost: { type: Number, default: 0 },
    referenceType: String,
    referenceId: String,
    patientId: { type: Schema.Types.ObjectId, ref: 'Patient', index: true },
    admissionId: { type: Schema.Types.ObjectId, ref: 'Admission' },
    departmentId: String,
    remarks: String,
    performedBy: { type: Schema.Types.ObjectId, ref: 'User' },
  },
  { timestamps: true, collection: 'stock_transactions' }
);

export const StockTransaction = mongoose.model<IStockTransaction>(
  'StockTransaction',
  StockTransactionSchema
);

export interface IPurchaseOrder extends Document {
  hospitalId: mongoose.Types.ObjectId;
  poNumber: string;
  vendorId: mongoose.Types.ObjectId;
  storeId: mongoose.Types.ObjectId;
  expectedDelivery?: Date;
  items: {
    itemId: mongoose.Types.ObjectId;
    quantity: number;
    unitPrice: number;
    receivedQuantity: number;
  }[];
  subtotal: number;
  tax: number;
  total: number;
  status: 'Draft' | 'Ordered' | 'Partial' | 'Received' | 'Cancelled';
  createdBy?: mongoose.Types.ObjectId;
}

const PurchaseOrderSchema = new Schema<IPurchaseOrder>(
  {
    hospitalId: { type: Schema.Types.ObjectId, ref: 'Hospital', required: true, index: true },
    poNumber: { type: String, required: true, index: true },
    vendorId: { type: Schema.Types.ObjectId, ref: 'Vendor', required: true },
    storeId: { type: Schema.Types.ObjectId, ref: 'InventoryStore', required: true },
    expectedDelivery: Date,
    items: [
      {
        itemId: { type: Schema.Types.ObjectId, ref: 'CatalogItem', required: true },
        quantity: Number,
        unitPrice: Number,
        receivedQuantity: { type: Number, default: 0 },
      },
    ],
    subtotal: { type: Number, default: 0 },
    tax: { type: Number, default: 0 },
    total: { type: Number, default: 0 },
    status: {
      type: String,
      enum: ['Draft', 'Ordered', 'Partial', 'Received', 'Cancelled'],
      default: 'Ordered',
    },
    createdBy: { type: Schema.Types.ObjectId, ref: 'User' },
  },
  { timestamps: true, collection: 'purchase_orders' }
);

export const PurchaseOrder = mongoose.model<IPurchaseOrder>('PurchaseOrder', PurchaseOrderSchema);

export interface IGoodsReceipt extends Document {
  hospitalId: mongoose.Types.ObjectId;
  grnNumber: string;
  purchaseOrderId?: mongoose.Types.ObjectId;
  vendorId?: mongoose.Types.ObjectId;
  storeId: mongoose.Types.ObjectId;
  receivedBy?: mongoose.Types.ObjectId;
  invoiceNumber?: string;
  receivedItems: {
    itemId: mongoose.Types.ObjectId;
    batchNumber: string;
    expiryDate?: Date;
    quantity: number;
    purchasePrice: number;
    sellingPrice: number;
    mrp: number;
  }[];
}

const GoodsReceiptSchema = new Schema<IGoodsReceipt>(
  {
    hospitalId: { type: Schema.Types.ObjectId, ref: 'Hospital', required: true, index: true },
    grnNumber: { type: String, required: true, index: true },
    purchaseOrderId: { type: Schema.Types.ObjectId, ref: 'PurchaseOrder' },
    vendorId: { type: Schema.Types.ObjectId, ref: 'Vendor' },
    storeId: { type: Schema.Types.ObjectId, ref: 'InventoryStore', required: true },
    receivedBy: { type: Schema.Types.ObjectId, ref: 'User' },
    invoiceNumber: String,
    receivedItems: [
      {
        itemId: { type: Schema.Types.ObjectId, ref: 'CatalogItem', required: true },
        batchNumber: String,
        expiryDate: Date,
        quantity: Number,
        purchasePrice: Number,
        sellingPrice: Number,
        mrp: Number,
      },
    ],
  },
  { timestamps: true, collection: 'goods_receipts' }
);

export const GoodsReceipt = mongoose.model<IGoodsReceipt>('GoodsReceipt', GoodsReceiptSchema);

export interface IStockTransfer extends Document {
  hospitalId: mongoose.Types.ObjectId;
  transferNumber: string;
  fromStoreId: mongoose.Types.ObjectId;
  toStoreId: mongoose.Types.ObjectId;
  status: 'Requested' | 'Approved' | 'Completed' | 'Rejected';
  items: { itemId: mongoose.Types.ObjectId; quantity: number }[];
  requestedBy?: mongoose.Types.ObjectId;
  approvedBy?: mongoose.Types.ObjectId;
  remarks?: string;
}

const StockTransferSchema = new Schema<IStockTransfer>(
  {
    hospitalId: { type: Schema.Types.ObjectId, ref: 'Hospital', required: true, index: true },
    transferNumber: { type: String, required: true, index: true },
    fromStoreId: { type: Schema.Types.ObjectId, ref: 'InventoryStore', required: true },
    toStoreId: { type: Schema.Types.ObjectId, ref: 'InventoryStore', required: true },
    status: {
      type: String,
      enum: ['Requested', 'Approved', 'Completed', 'Rejected'],
      default: 'Requested',
      index: true,
    },
    items: [
      {
        itemId: { type: Schema.Types.ObjectId, ref: 'CatalogItem', required: true },
        quantity: Number,
      },
    ],
    requestedBy: { type: Schema.Types.ObjectId, ref: 'User' },
    approvedBy: { type: Schema.Types.ObjectId, ref: 'User' },
    remarks: String,
  },
  { timestamps: true, collection: 'stock_transfers' }
);

export const StockTransfer = mongoose.model<IStockTransfer>('StockTransfer', StockTransferSchema);

export interface IInventoryAuditLog extends Document {
  hospitalId: mongoose.Types.ObjectId;
  userId?: mongoose.Types.ObjectId;
  action: string;
  entityType: string;
  entityId?: string;
  oldValue?: any;
  newValue?: any;
  ip?: string;
}

const InventoryAuditLogSchema = new Schema<IInventoryAuditLog>(
  {
    hospitalId: { type: Schema.Types.ObjectId, ref: 'Hospital', required: true, index: true },
    userId: { type: Schema.Types.ObjectId, ref: 'User' },
    action: { type: String, required: true },
    entityType: String,
    entityId: String,
    oldValue: Schema.Types.Mixed,
    newValue: Schema.Types.Mixed,
    ip: String,
  },
  { timestamps: true, collection: 'inventory_audit_logs' }
);

export const InventoryAuditLog = mongoose.model<IInventoryAuditLog>(
  'InventoryAuditLog',
  InventoryAuditLogSchema
);

export const DEFAULT_STORES: { name: string; type: StoreType }[] = [
  { name: 'Main Warehouse', type: 'Main Warehouse' },
  { name: 'Pharmacy', type: 'Pharmacy' },
  { name: 'Operation Theater', type: 'Operation Theater' },
  { name: 'ICU', type: 'ICU' },
  { name: 'Emergency', type: 'Emergency' },
  { name: 'General Ward', type: 'General Ward' },
  { name: 'Laboratory', type: 'Laboratory' },
  { name: 'Radiology', type: 'Radiology' },
  { name: 'CSSD', type: 'CSSD' },
];
