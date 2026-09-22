import mongoose from 'mongoose';
import { AppError } from '../../common';
import { appendChargesToPatientBill } from '../billing/billing.service';
import {
  CatalogItem,
  DEFAULT_STORES,
  InventoryAuditLog,
  InventoryBatch,
  InventoryCategory,
  InventoryStore,
  PurchaseOrder,
  GoodsReceipt,
  StockTransaction,
  StockTransfer,
  Vendor,
} from './models';

const oid = (id: string | mongoose.Types.ObjectId) =>
  typeof id === 'string' ? new mongoose.Types.ObjectId(id) : id;

export const logInventoryAction = async (params: {
  hospitalId: any;
  userId?: any;
  action: string;
  entityType: string;
  entityId?: string;
  oldValue?: any;
  newValue?: any;
  ip?: string;
}) => {
  await InventoryAuditLog.create(params);
};

export const ensureDefaultStores = async (hospitalId: any) => {
  const count = await InventoryStore.countDocuments({ hospitalId });
  if (count > 0) return InventoryStore.find({ hospitalId, isActive: true }).sort({ name: 1 });

  await InventoryStore.insertMany(
    DEFAULT_STORES.map((s) => ({
      hospitalId,
      name: s.name,
      type: s.type,
      isActive: true,
    }))
  );
  return InventoryStore.find({ hospitalId, isActive: true }).sort({ name: 1 });
};

export const nextDocNumber = async (
  hospitalId: any,
  Model: any,
  field: string,
  prefix: string
) => {
  const count = await Model.countDocuments({ hospitalId });
  return `${prefix}-${String(count + 1).padStart(5, '0')}`;
};

/** Available stock for item in a store (sum of non-expired batch availableQuantity) */
export const getAvailableStock = async (
  hospitalId: any,
  itemId: string,
  storeId?: string
) => {
  const match: any = {
    hospitalId: oid(hospitalId),
    itemId: oid(itemId),
    availableQuantity: { $gt: 0 },
    $or: [{ expiryDate: null }, { expiryDate: { $gt: new Date() } }],
  };
  if (storeId) match.storeId = oid(storeId);

  const [row] = await InventoryBatch.aggregate([
    { $match: match },
    { $group: { _id: null, qty: { $sum: '$availableQuantity' }, value: { $sum: { $multiply: ['$availableQuantity', '$purchasePrice'] } } } },
  ]);
  return { quantity: row?.qty || 0, value: row?.value || 0 };
};

/**
 * FEFO: consume earliest-expiry non-expired batches first.
 * Returns batch-wise deductions.
 */
export const consumeFefo = async (params: {
  hospitalId: any;
  itemId: string;
  storeId: string;
  quantity: number;
  transactionType?: 'CONSUMPTION' | 'TRANSFER' | 'DAMAGE' | 'EXPIRED' | 'ADJUSTMENT';
  patientId?: string;
  admissionId?: string;
  departmentId?: string;
  remarks?: string;
  performedBy?: string;
  referenceType?: string;
  referenceId?: string;
  billPatient?: boolean;
}) => {
  const qtyNeeded = Number(params.quantity);
  if (!qtyNeeded || qtyNeeded <= 0) throw new AppError('Quantity must be positive', 400);

  const item = await CatalogItem.findOne({
    _id: params.itemId,
    hospitalId: params.hospitalId,
    isActive: true,
  });
  if (!item) throw new AppError('Catalog item not found', 404);

  const now = new Date();
  const batches = await InventoryBatch.find({
    hospitalId: params.hospitalId,
    itemId: params.itemId,
    storeId: params.storeId,
    availableQuantity: { $gt: 0 },
    $or: [{ expiryDate: null }, { expiryDate: { $gt: now } }],
  }).sort({ expiryDate: 1, createdAt: 1 });

  const available = batches.reduce((s, b) => s + b.availableQuantity, 0);
  if (available < qtyNeeded) {
    throw new AppError(`Insufficient stock. Available: ${available}, requested: ${qtyNeeded}`, 400);
  }

  let remaining = qtyNeeded;
  const deductions: { batchId: string; quantity: number; unitPrice: number; batchNumber: string }[] = [];
  const txns: any[] = [];

  for (const batch of batches) {
    if (remaining <= 0) break;
    const take = Math.min(batch.availableQuantity, remaining);
    batch.availableQuantity -= take;
    batch.quantity = Math.max(0, batch.quantity - take);
    await batch.save();

    const unitCost = batch.sellingPrice || item.sellingPrice || batch.purchasePrice || 0;
    deductions.push({
      batchId: String(batch._id),
      quantity: take,
      unitPrice: unitCost,
      batchNumber: batch.batchNumber,
    });

    txns.push({
      hospitalId: params.hospitalId,
      itemId: item._id,
      batchId: batch._id,
      fromStoreId: params.storeId,
      transactionType: params.transactionType || 'CONSUMPTION',
      quantity: take,
      unitCost,
      referenceType: params.referenceType,
      referenceId: params.referenceId,
      patientId: params.patientId,
      admissionId: params.admissionId,
      departmentId: params.departmentId,
      remarks: params.remarks,
      performedBy: params.performedBy,
    });

    remaining -= take;
  }

  await StockTransaction.insertMany(txns);

  let invoice = null;
  if (params.billPatient && params.patientId) {
    invoice = await appendChargesToPatientBill(
      params.hospitalId,
      params.patientId,
      deductions.map((d) => ({
        description: `${item.name} (Batch ${d.batchNumber})`,
        category: 'Pharmacy' as const,
        quantity: d.quantity,
        unitPrice: d.unitPrice,
        taxRate: item.gstRate || 0,
      }))
    );
  }

  await logInventoryAction({
    hospitalId: params.hospitalId,
    userId: params.performedBy,
    action: params.transactionType || 'CONSUMPTION',
    entityType: 'CatalogItem',
    entityId: String(item._id),
    newValue: { quantity: qtyNeeded, deductions, patientId: params.patientId },
  });

  return { item, deductions, invoice };
};

/** Move stock FEFO from source store to destination (creates destination batches) */
export const transferStockFefo = async (params: {
  hospitalId: any;
  fromStoreId: string;
  toStoreId: string;
  itemId: string;
  quantity: number;
  performedBy?: string;
  referenceType?: string;
  referenceId?: string;
  remarks?: string;
}) => {
  const qtyNeeded = Number(params.quantity);
  const now = new Date();
  const batches = await InventoryBatch.find({
    hospitalId: params.hospitalId,
    itemId: params.itemId,
    storeId: params.fromStoreId,
    availableQuantity: { $gt: 0 },
    $or: [{ expiryDate: null }, { expiryDate: { $gt: now } }],
  }).sort({ expiryDate: 1, createdAt: 1 });

  const available = batches.reduce((s, b) => s + b.availableQuantity, 0);
  if (available < qtyNeeded) {
    throw new AppError(`Insufficient stock for transfer. Available: ${available}`, 400);
  }

  let remaining = qtyNeeded;
  const txns: any[] = [];

  for (const batch of batches) {
    if (remaining <= 0) break;
    const take = Math.min(batch.availableQuantity, remaining);
    batch.availableQuantity -= take;
    batch.quantity = Math.max(0, batch.quantity - take);
    await batch.save();

    let dest = await InventoryBatch.findOne({
      hospitalId: params.hospitalId,
      itemId: params.itemId,
      storeId: params.toStoreId,
      batchNumber: batch.batchNumber,
    });

    if (dest) {
      dest.quantity += take;
      dest.availableQuantity += take;
      await dest.save();
    } else {
      dest = await InventoryBatch.create({
        hospitalId: params.hospitalId,
        itemId: params.itemId,
        storeId: params.toStoreId,
        batchNumber: batch.batchNumber,
        expiryDate: batch.expiryDate,
        manufactureDate: batch.manufactureDate,
        purchasePrice: batch.purchasePrice,
        sellingPrice: batch.sellingPrice,
        mrp: batch.mrp,
        quantity: take,
        reservedQuantity: 0,
        availableQuantity: take,
        vendorId: batch.vendorId,
      });
    }

    txns.push({
      hospitalId: params.hospitalId,
      itemId: params.itemId,
      batchId: batch._id,
      fromStoreId: params.fromStoreId,
      toStoreId: params.toStoreId,
      transactionType: 'TRANSFER',
      quantity: take,
      unitCost: batch.purchasePrice,
      referenceType: params.referenceType,
      referenceId: params.referenceId,
      remarks: params.remarks,
      performedBy: params.performedBy,
    });

    remaining -= take;
  }

  await StockTransaction.insertMany(txns);
  return { transferred: qtyNeeded };
};

export const receiveGoods = async (params: {
  hospitalId: any;
  storeId: string;
  vendorId?: string;
  purchaseOrderId?: string;
  invoiceNumber?: string;
  receivedBy?: string;
  receivedItems: {
    itemId: string;
    batchNumber: string;
    expiryDate?: string | Date;
    quantity: number;
    purchasePrice: number;
    sellingPrice?: number;
    mrp?: number;
  }[];
}) => {
  if (!params.receivedItems?.length) throw new AppError('No items to receive', 400);

  const grnNumber = await nextDocNumber(params.hospitalId, GoodsReceipt, 'grnNumber', 'GRN');
  const createdBatches: any[] = [];
  const txns: any[] = [];

  for (const line of params.receivedItems) {
    const qty = Number(line.quantity);
    if (qty <= 0) continue;

    let batch = await InventoryBatch.findOne({
      hospitalId: params.hospitalId,
      itemId: line.itemId,
      storeId: params.storeId,
      batchNumber: line.batchNumber,
    });

    const catalog = await CatalogItem.findById(line.itemId).select('barcode sellingPrice');

    if (batch) {
      batch.quantity += qty;
      batch.availableQuantity += qty;
      batch.quantityReceived = (batch.quantityReceived || 0) + qty;
      if (line.purchasePrice != null) batch.purchasePrice = line.purchasePrice;
      if (line.sellingPrice != null) batch.sellingPrice = line.sellingPrice;
      if (line.mrp != null) batch.mrp = line.mrp;
      if (line.expiryDate) batch.expiryDate = new Date(line.expiryDate);
      if (!batch.barcode && catalog?.barcode) batch.barcode = catalog.barcode;
      await batch.save();
    } else {
      batch = await InventoryBatch.create({
        hospitalId: params.hospitalId,
        itemId: line.itemId,
        storeId: params.storeId,
        barcode: catalog?.barcode,
        batchNumber: line.batchNumber || `B-${Date.now()}`,
        expiryDate: line.expiryDate ? new Date(line.expiryDate) : undefined,
        purchasePrice: line.purchasePrice || 0,
        sellingPrice: line.sellingPrice ?? line.purchasePrice ?? 0,
        mrp: line.mrp ?? line.sellingPrice ?? line.purchasePrice ?? 0,
        quantity: qty,
        quantityReceived: qty,
        reservedQuantity: 0,
        availableQuantity: qty,
        vendorId: params.vendorId,
      });
    }

    createdBatches.push(batch);
    txns.push({
      hospitalId: params.hospitalId,
      itemId: line.itemId,
      batchId: batch._id,
      toStoreId: params.storeId,
      transactionType: 'PURCHASE',
      quantity: qty,
      unitCost: line.purchasePrice || 0,
      referenceType: 'GRN',
      referenceId: grnNumber,
      performedBy: params.receivedBy,
    });

    if (params.purchaseOrderId) {
      const po = await PurchaseOrder.findOne({
        _id: params.purchaseOrderId,
        hospitalId: params.hospitalId,
      });
      if (po) {
        const poLine = po.items.find((i) => String(i.itemId) === String(line.itemId));
        if (poLine) {
          poLine.receivedQuantity = (poLine.receivedQuantity || 0) + qty;
        }
        const allReceived = po.items.every((i) => (i.receivedQuantity || 0) >= i.quantity);
        const anyReceived = po.items.some((i) => (i.receivedQuantity || 0) > 0);
        po.status = allReceived ? 'Received' : anyReceived ? 'Partial' : po.status;
        await po.save();
      }
    }
  }

  await StockTransaction.insertMany(txns);

  const grn = await GoodsReceipt.create({
    hospitalId: params.hospitalId,
    grnNumber,
    purchaseOrderId: params.purchaseOrderId,
    vendorId: params.vendorId,
    storeId: params.storeId,
    receivedBy: params.receivedBy,
    invoiceNumber: params.invoiceNumber,
    receivedItems: params.receivedItems.map((r) => ({
      itemId: r.itemId,
      batchNumber: r.batchNumber,
      expiryDate: r.expiryDate ? new Date(r.expiryDate) : undefined,
      quantity: r.quantity,
      purchasePrice: r.purchasePrice,
      sellingPrice: r.sellingPrice ?? r.purchasePrice,
      mrp: r.mrp ?? r.sellingPrice ?? r.purchasePrice,
    })),
  });

  await logInventoryAction({
    hospitalId: params.hospitalId,
    userId: params.receivedBy,
    action: 'GOODS_RECEIPT',
    entityType: 'GoodsReceipt',
    entityId: String(grn._id),
    newValue: { grnNumber, lines: params.receivedItems.length },
  });

  return { grn, batches: createdBatches };
};

/**
 * Manufacturer barcode receive:
 * - Scan barcode → find existing CatalogItem OR create new
 * - Then create/update inventory batch with qty, expiry, prices, vendor
 */
export const receiveByBarcode = async (params: {
  hospitalId: any;
  barcode: string;
  storeId: string;
  batchNumber: string;
  quantity: number;
  purchasePrice: number;
  sellingPrice?: number;
  mrp?: number;
  expiryDate?: string | Date;
  vendorId?: string;
  /** Required when creating a new catalog item */
  name?: string;
  unit?: string;
  manufacturer?: string;
  categoryId?: string;
  reorderLevel?: number;
  gstRate?: number;
  receivedBy?: string;
  invoiceNumber?: string;
}) => {
  const barcode = String(params.barcode || '').trim();
  if (!barcode) throw new AppError('Manufacturer barcode is required', 400);
  if (!params.storeId) throw new AppError('storeId is required', 400);
  if (!params.batchNumber) throw new AppError('batchNumber is required', 400);
  if (!params.quantity || Number(params.quantity) <= 0) {
    throw new AppError('quantity must be positive', 400);
  }

  let item = await CatalogItem.findOne({
    hospitalId: params.hospitalId,
    barcode,
    isActive: true,
  });
  let createdItem = false;

  if (!item) {
    if (!params.name?.trim()) {
      throw new AppError(
        'Barcode not found. Provide name to create a new inventory item for this manufacturer barcode.',
        404
      );
    }
    const count = await CatalogItem.countDocuments({ hospitalId: params.hospitalId });
    const itemCode = `ITM-${String(count + 1).padStart(5, '0')}`;
    item = await CatalogItem.create({
      hospitalId: params.hospitalId,
      itemCode,
      barcode,
      name: params.name.trim(),
      unit: params.unit || 'pcs',
      manufacturer: params.manufacturer,
      categoryId: params.categoryId || undefined,
      reorderLevel: params.reorderLevel ?? 10,
      reorderQuantity: 50,
      safetyStock: 5,
      gstRate: params.gstRate ?? 0,
      sellingPrice: params.sellingPrice ?? params.purchasePrice ?? 0,
      isBatchTracked: true,
      isExpiryTracked: true,
      isActive: true,
      createdBy: params.receivedBy,
    });
    createdItem = true;
  } else if (params.sellingPrice != null) {
    item.sellingPrice = params.sellingPrice;
    await item.save();
  }

  const result = await receiveGoods({
    hospitalId: params.hospitalId,
    storeId: params.storeId,
    vendorId: params.vendorId,
    invoiceNumber: params.invoiceNumber,
    receivedBy: params.receivedBy,
    receivedItems: [
      {
        itemId: String(item._id),
        batchNumber: params.batchNumber,
        expiryDate: params.expiryDate,
        quantity: Number(params.quantity),
        purchasePrice: Number(params.purchasePrice) || 0,
        sellingPrice: params.sellingPrice ?? item.sellingPrice,
        mrp: params.mrp ?? params.sellingPrice ?? item.sellingPrice,
      },
    ],
  });

  await logInventoryAction({
    hospitalId: params.hospitalId,
    userId: params.receivedBy,
    action: 'BARCODE_RECEIVE',
    entityType: 'CatalogItem',
    entityId: String(item._id),
    newValue: {
      barcode,
      batchNumber: params.batchNumber,
      quantity: params.quantity,
      createdItem,
    },
  });

  return {
    createdItem,
    item,
    ...result,
  };
};

export const getPatientConsumption = async (
  hospitalId: any,
  opts: { patientId?: string; admissionId?: string; days?: number }
) => {
  const filter: any = {
    hospitalId: oid(hospitalId),
    transactionType: 'CONSUMPTION',
  };
  if (opts.patientId) filter.patientId = oid(opts.patientId);
  if (opts.admissionId) filter.admissionId = oid(opts.admissionId);
  if (opts.days) {
    filter.createdAt = { $gte: new Date(Date.now() - opts.days * 86400000) };
  }

  return StockTransaction.find(filter)
    .populate('itemId', 'name itemCode barcode unit sellingPrice')
    .populate('batchId', 'batchNumber expiryDate barcode sellingPrice')
    .populate('patientId', 'name patientId')
    .populate('fromStoreId', 'name')
    .populate('performedBy', 'name')
    .sort({ createdAt: -1 })
    .limit(500);
};

export const getStockByStore = async (hospitalId: any, storeId?: string) => {
  const match: any = { hospitalId: oid(hospitalId), availableQuantity: { $gt: 0 } };
  if (storeId) match.storeId = oid(storeId);

  return InventoryBatch.aggregate([
    { $match: match },
    {
      $group: {
        _id: { itemId: '$itemId', storeId: '$storeId' },
        quantity: { $sum: '$availableQuantity' },
        value: { $sum: { $multiply: ['$availableQuantity', '$purchasePrice'] } },
        batches: { $sum: 1 },
        nearestExpiry: { $min: '$expiryDate' },
      },
    },
    {
      $lookup: {
        from: 'inventory_items',
        localField: '_id.itemId',
        foreignField: '_id',
        as: 'item',
      },
    },
    { $unwind: '$item' },
    {
      $lookup: {
        from: 'inventory_stores',
        localField: '_id.storeId',
        foreignField: '_id',
        as: 'store',
      },
    },
    { $unwind: '$store' },
    {
      $project: {
        itemId: '$_id.itemId',
        storeId: '$_id.storeId',
        itemCode: '$item.itemCode',
        name: '$item.name',
        unit: '$item.unit',
        reorderLevel: '$item.reorderLevel',
        sellingPrice: '$item.sellingPrice',
        storeName: '$store.name',
        quantity: 1,
        value: 1,
        batches: 1,
        nearestExpiry: 1,
        isLow: { $lte: ['$quantity', '$item.reorderLevel'] },
      },
    },
    { $sort: { name: 1 } },
  ]);
};

export const getDashboardMetrics = async (hospitalId: any) => {
  await ensureDefaultStores(hospitalId);
  const now = new Date();
  const in30 = new Date(now.getTime() + 30 * 86400000);
  const in90 = new Date(now.getTime() + 90 * 86400000);

  const [valueAgg, lowStock, expiring, expired, storeValues, consumption, categories] =
    await Promise.all([
      InventoryBatch.aggregate([
        { $match: { hospitalId: oid(hospitalId), availableQuantity: { $gt: 0 } } },
        {
          $group: {
            _id: null,
            totalValue: { $sum: { $multiply: ['$availableQuantity', '$purchasePrice'] } },
            totalQty: { $sum: '$availableQuantity' },
            batchCount: { $sum: 1 },
          },
        },
      ]),
      getStockByStore(hospitalId).then((rows) => rows.filter((r: any) => r.isLow)),
      InventoryBatch.find({
        hospitalId,
        availableQuantity: { $gt: 0 },
        expiryDate: { $gte: now, $lte: in30 },
      })
        .populate('itemId', 'name itemCode')
        .populate('storeId', 'name')
        .limit(50),
      InventoryBatch.find({
        hospitalId,
        availableQuantity: { $gt: 0 },
        expiryDate: { $lt: now },
      })
        .populate('itemId', 'name itemCode')
        .populate('storeId', 'name')
        .limit(50),
      InventoryBatch.aggregate([
        { $match: { hospitalId: oid(hospitalId), availableQuantity: { $gt: 0 } } },
        {
          $group: {
            _id: '$storeId',
            value: { $sum: { $multiply: ['$availableQuantity', '$purchasePrice'] } },
            qty: { $sum: '$availableQuantity' },
          },
        },
        {
          $lookup: {
            from: 'inventory_stores',
            localField: '_id',
            foreignField: '_id',
            as: 'store',
          },
        },
        { $unwind: '$store' },
        { $project: { storeName: '$store.name', value: 1, qty: 1 } },
      ]),
      StockTransaction.aggregate([
        {
          $match: {
            hospitalId: oid(hospitalId),
            transactionType: 'CONSUMPTION',
            createdAt: { $gte: new Date(now.getTime() - 30 * 86400000) },
          },
        },
        {
          $group: {
            _id: { $dateToString: { format: '%Y-%m-%d', date: '$createdAt' } },
            qty: { $sum: '$quantity' },
            value: { $sum: { $multiply: ['$quantity', '$unitCost'] } },
          },
        },
        { $sort: { _id: 1 } },
      ]),
      CatalogItem.aggregate([
        { $match: { hospitalId: oid(hospitalId), isActive: true } },
        { $group: { _id: '$categoryId', count: { $sum: 1 } } },
        {
          $lookup: {
            from: 'inventory_categories',
            localField: '_id',
            foreignField: '_id',
            as: 'cat',
          },
        },
        {
          $project: {
            name: { $ifNull: [{ $arrayElemAt: ['$cat.name', 0] }, 'Uncategorized'] },
            count: 1,
          },
        },
      ]),
    ]);

  const expiredLoss = expired.reduce(
    (s, b: any) => s + (b.availableQuantity || 0) * (b.purchasePrice || 0),
    0
  );

  const outOfStock = await CatalogItem.countDocuments({ hospitalId, isActive: true }).then(
    async (totalItems) => {
      const withStock = await InventoryBatch.distinct('itemId', {
        hospitalId,
        availableQuantity: { $gt: 0 },
        $or: [{ expiryDate: null }, { expiryDate: { $gt: now } }],
      });
      return Math.max(0, totalItems - withStock.length);
    }
  );

  const soon90 = await InventoryBatch.countDocuments({
    hospitalId,
    availableQuantity: { $gt: 0 },
    expiryDate: { $gte: now, $lte: in90 },
  });

  return {
    totalInventoryValue: valueAgg[0]?.totalValue || 0,
    totalQuantity: valueAgg[0]?.totalQty || 0,
    batchCount: valueAgg[0]?.batchCount || 0,
    lowStockCount: lowStock.length,
    lowStockItems: lowStock.slice(0, 20),
    outOfStockCount: outOfStock,
    expiringThisMonth: expiring,
    expiredStock: expired,
    expiryLossValue: expiredLoss,
    expiring90Days: soon90,
    storeWiseValue: storeValues,
    consumptionTrend: consumption,
    categoryDistribution: categories,
  };
};

export const getExpiryAlerts = async (hospitalId: any) => {
  const now = new Date();
  const buckets = [7, 15, 30, 60, 90];
  const result: Record<string, any[]> = {
    expired: [],
    d7: [],
    d15: [],
    d30: [],
    d60: [],
    d90: [],
  };

  const expired = await InventoryBatch.find({
    hospitalId,
    availableQuantity: { $gt: 0 },
    expiryDate: { $lt: now },
  })
    .populate('itemId', 'name itemCode')
    .populate('storeId', 'name')
    .limit(100);
  result.expired = expired;

  let prev = now;
  for (const days of buckets) {
    const end = new Date(now.getTime() + days * 86400000);
    const rows = await InventoryBatch.find({
      hospitalId,
      availableQuantity: { $gt: 0 },
      expiryDate: { $gt: prev, $lte: end },
    })
      .populate('itemId', 'name itemCode')
      .populate('storeId', 'name')
      .limit(100);
    result[`d${days}`] = rows;
    prev = end;
  }

  return result;
};

export { CatalogItem, InventoryStore, InventoryCategory, Vendor, PurchaseOrder, StockTransfer };
