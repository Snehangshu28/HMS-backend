import { Request, Response } from 'express';
import { AppError, asyncHandler, sendResponse } from '../../common';
import {
  CatalogItem,
  InventoryBatch,
  InventoryCategory,
  InventoryStore,
  PurchaseOrder,
  StockTransfer,
  StockTransaction,
  Vendor,
} from './models';
import mongoose from 'mongoose';
import {
  consumeFefo,
  ensureDefaultStores,
  getAvailableStock,
  getDashboardMetrics,
  getExpiryAlerts,
  getPatientConsumption,
  getStockByStore,
  logInventoryAction,
  nextDocNumber,
  receiveByBarcode,
  receiveGoods,
  transferStockFefo,
} from './inventory.service';
import { scanConsume, applyProcedureTemplate } from '../resources/resources.service';

const oid = (id: any) =>
  typeof id === 'string' ? new mongoose.Types.ObjectId(id) : id;

/* ─── Stores ─── */
export const listStores = asyncHandler(async (req: Request, res: Response) => {
  const stores = await ensureDefaultStores(req.hospitalId);
  return sendResponse(res, 200, 'Stores retrieved', stores);
});

export const createStore = asyncHandler(async (req: Request, res: Response) => {
  const { name, type, location, managerId } = req.body;
  if (!name || !type) throw new AppError('Name and type are required', 400);
  const store = await InventoryStore.create({
    hospitalId: req.hospitalId,
    name,
    type,
    location,
    managerId,
  });
  return sendResponse(res, 201, 'Store created', store);
});

/* ─── Categories ─── */
export const listCategories = asyncHandler(async (req: Request, res: Response) => {
  const cats = await InventoryCategory.find({ hospitalId: req.hospitalId }).sort({ name: 1 });
  return sendResponse(res, 200, 'Categories retrieved', cats);
});

export const createCategory = asyncHandler(async (req: Request, res: Response) => {
  const { name, parentCategory, description } = req.body;
  if (!name) throw new AppError('Name is required', 400);
  const cat = await InventoryCategory.create({
    hospitalId: req.hospitalId,
    name,
    parentCategory,
    description,
  });
  return sendResponse(res, 201, 'Category created', cat);
});

/* ─── Catalog items ─── */
export const listCatalogItems = asyncHandler(async (req: Request, res: Response) => {
  const { q, active } = req.query;
  const filter: any = { hospitalId: req.hospitalId };
  if (active !== 'false') filter.isActive = true;
  if (q) {
    filter.$or = [
      { name: new RegExp(String(q), 'i') },
      { itemCode: new RegExp(String(q), 'i') },
      { barcode: new RegExp(String(q), 'i') },
      { genericName: new RegExp(String(q), 'i') },
    ];
  }

  const page = Math.max(1, Number(req.query.page) || 1);
  const limit = Math.min(100, Number(req.query.limit) || 50);
  const [items, total] = await Promise.all([
    CatalogItem.find(filter)
      .populate('categoryId', 'name')
      .sort({ name: 1 })
      .skip((page - 1) * limit)
      .limit(limit),
    CatalogItem.countDocuments(filter),
  ]);

  return sendResponse(res, 200, 'Catalog items retrieved', { items, total, page, limit });
});

export const getCatalogItemByBarcode = asyncHandler(async (req: Request, res: Response) => {
  const code = decodeURIComponent(String(req.params.code || '')).trim();
  if (!code) throw new AppError('Barcode is required', 400);

  let lookup = code;
  if (code.includes('|')) lookup = code.split('|')[0];

  const item = await CatalogItem.findOne({
    hospitalId: req.hospitalId,
    isActive: true,
    $or: [{ barcode: lookup }, { itemCode: lookup }, { barcode: code }, { itemCode: code }],
  }).populate('categoryId', 'name');

  if (!item) throw new AppError('Item not found for barcode', 404);

  const stock = await getAvailableStock(req.hospitalId, String(item._id), req.query.storeId as string);
  return sendResponse(res, 200, 'Item found by barcode', { item, stock });
});

export const createCatalogItem = asyncHandler(async (req: Request, res: Response) => {
  const {
    itemCode,
    barcode,
    name,
    genericName,
    categoryId,
    unit,
    reorderLevel,
    reorderQuantity,
    safetyStock,
    maxStock,
    hsnCode,
    gstRate,
    manufacturer,
    isBatchTracked,
    isExpiryTracked,
    sellingPrice,
    openingStock,
    storeId,
    batchNumber,
    expiryDate,
    purchasePrice,
  } = req.body;

  if (!itemCode || !name) throw new AppError('itemCode and name are required', 400);

  const existing = await CatalogItem.findOne({ hospitalId: req.hospitalId, itemCode });
  if (existing) throw new AppError('Item code already exists', 400);

  const code = String(itemCode).toUpperCase();
  const item = await CatalogItem.create({
    hospitalId: req.hospitalId,
    itemCode: code,
    barcode: barcode || code,
    name,
    genericName,
    categoryId: categoryId || undefined,
    unit: unit || 'pcs',
    reorderLevel: Number(reorderLevel) || 10,
    reorderQuantity: Number(reorderQuantity) || 50,
    safetyStock: Number(safetyStock) || 5,
    maxStock,
    hsnCode,
    gstRate: Number(gstRate) || 0,
    manufacturer,
    isBatchTracked: isBatchTracked !== false,
    isExpiryTracked: isExpiryTracked !== false,
    sellingPrice: Number(sellingPrice) || 0,
    createdBy: req.user?.id,
  });

  // Optional opening stock (ledger = OPENING_STOCK only)
  if (openingStock && Number(openingStock) > 0 && storeId) {
    const qty = Number(openingStock);
    const batch = await InventoryBatch.create({
      hospitalId: req.hospitalId,
      itemId: item._id,
      storeId,
      batchNumber: batchNumber || 'OPENING',
      expiryDate: expiryDate ? new Date(expiryDate) : undefined,
      purchasePrice: Number(purchasePrice) || 0,
      sellingPrice: Number(sellingPrice) || 0,
      mrp: Number(sellingPrice) || Number(purchasePrice) || 0,
      quantity: qty,
      reservedQuantity: 0,
      availableQuantity: qty,
    });
    await StockTransaction.create({
      hospitalId: req.hospitalId,
      itemId: item._id,
      batchId: batch._id,
      toStoreId: storeId,
      transactionType: 'OPENING_STOCK',
      quantity: qty,
      unitCost: Number(purchasePrice) || 0,
      performedBy: req.user?.id,
      remarks: 'Opening stock on item create',
    });
  }

  await logInventoryAction({
    hospitalId: req.hospitalId,
    userId: req.user?.id,
    action: 'CREATE_ITEM',
    entityType: 'CatalogItem',
    entityId: String(item._id),
    newValue: item.toObject(),
  });

  return sendResponse(res, 201, 'Catalog item created', item);
});

export const updateCatalogItem = asyncHandler(async (req: Request, res: Response) => {
  const item = await CatalogItem.findOne({ _id: req.params.id, hospitalId: req.hospitalId });
  if (!item) throw new AppError('Item not found', 404);
  const old = item.toObject();

  const fields = [
    'name',
    'genericName',
    'categoryId',
    'unit',
    'reorderLevel',
    'reorderQuantity',
    'safetyStock',
    'maxStock',
    'hsnCode',
    'gstRate',
    'manufacturer',
    'isBatchTracked',
    'isExpiryTracked',
    'sellingPrice',
    'barcode',
    'isActive',
  ] as const;

  for (const f of fields) {
    if (req.body[f] !== undefined) (item as any)[f] = req.body[f];
  }
  await item.save();

  await logInventoryAction({
    hospitalId: req.hospitalId,
    userId: req.user?.id,
    action: 'UPDATE_ITEM',
    entityType: 'CatalogItem',
    entityId: String(item._id),
    oldValue: old,
    newValue: item.toObject(),
  });

  return sendResponse(res, 200, 'Item updated', item);
});

export const deleteCatalogItem = asyncHandler(async (req: Request, res: Response) => {
  const item = await CatalogItem.findOne({ _id: req.params.id, hospitalId: req.hospitalId });
  if (!item) throw new AppError('Item not found', 404);
  item.isActive = false;
  await item.save();
  return sendResponse(res, 200, 'Item deactivated', item);
});

/* ─── Stock ─── */
export const getStock = asyncHandler(async (req: Request, res: Response) => {
  await ensureDefaultStores(req.hospitalId);
  const stock = await getStockByStore(req.hospitalId, req.query.storeId as string | undefined);
  return sendResponse(res, 200, 'Stock retrieved', stock);
});

export const getItemStock = asyncHandler(async (req: Request, res: Response) => {
  const { itemId } = req.params;
  const storeId = req.query.storeId as string | undefined;
  const stock = await getAvailableStock(req.hospitalId, itemId, storeId);
  const batches = await InventoryBatch.find({
    hospitalId: req.hospitalId,
    itemId,
    ...(storeId ? { storeId } : {}),
    availableQuantity: { $gt: 0 },
  })
    .populate('storeId', 'name type')
    .sort({ expiryDate: 1 });
  return sendResponse(res, 200, 'Item stock retrieved', { ...stock, batches });
});

export const listBatches = asyncHandler(async (req: Request, res: Response) => {
  const filter: any = { hospitalId: req.hospitalId };
  if (req.query.storeId) filter.storeId = req.query.storeId;
  if (req.query.itemId) filter.itemId = req.query.itemId;
  if (req.query.expiring === 'true') {
    const in30 = new Date(Date.now() + 30 * 86400000);
    filter.expiryDate = { $lte: in30 };
    filter.availableQuantity = { $gt: 0 };
  }

  const batches = await InventoryBatch.find(filter)
    .populate('itemId', 'name itemCode unit')
    .populate('storeId', 'name')
    .populate('vendorId', 'name')
    .sort({ expiryDate: 1 })
    .limit(200);

  return sendResponse(res, 200, 'Batches retrieved', batches);
});

/* ─── Consume (patient / department) ─── */
export const consumeStock = asyncHandler(async (req: Request, res: Response) => {
  const {
    itemId,
    storeId,
    quantity,
    patientId,
    admissionId,
    departmentId,
    remarks,
    billPatient = true,
  } = req.body;

  if (!itemId || !storeId || !quantity) {
    throw new AppError('itemId, storeId, and quantity are required', 400);
  }

  const result = await consumeFefo({
    hospitalId: req.hospitalId,
    itemId,
    storeId,
    quantity: Number(quantity),
    patientId,
    admissionId,
    departmentId,
    remarks,
    performedBy: req.user?.id,
    billPatient: Boolean(patientId) && billPatient !== false,
    referenceType: patientId ? 'PATIENT_CONSUMPTION' : 'DEPARTMENT_CONSUMPTION',
  });

  return sendResponse(res, 200, 'Stock consumed (FEFO)', result);
});

/* ─── Transfers ─── */
export const createTransfer = asyncHandler(async (req: Request, res: Response) => {
  const { fromStoreId, toStoreId, items, remarks } = req.body;
  if (!fromStoreId || !toStoreId || !items?.length) {
    throw new AppError('fromStoreId, toStoreId, and items are required', 400);
  }
  if (fromStoreId === toStoreId) throw new AppError('Source and destination must differ', 400);

  const transferNumber = await nextDocNumber(req.hospitalId, StockTransfer, 'transferNumber', 'TRF');
  const transfer = await StockTransfer.create({
    hospitalId: req.hospitalId,
    transferNumber,
    fromStoreId,
    toStoreId,
    items,
    remarks,
    requestedBy: req.user?.id,
    status: 'Requested',
  });

  return sendResponse(res, 201, 'Transfer requested', transfer);
});

export const listTransfers = asyncHandler(async (req: Request, res: Response) => {
  const transfers = await StockTransfer.find({ hospitalId: req.hospitalId })
    .populate('fromStoreId', 'name')
    .populate('toStoreId', 'name')
    .populate('items.itemId', 'name itemCode')
    .sort({ createdAt: -1 })
    .limit(100);
  return sendResponse(res, 200, 'Transfers retrieved', transfers);
});

export const approveTransfer = asyncHandler(async (req: Request, res: Response) => {
  const transfer = await StockTransfer.findOne({
    _id: req.params.id,
    hospitalId: req.hospitalId,
  });
  if (!transfer) throw new AppError('Transfer not found', 404);
  if (transfer.status !== 'Requested') throw new AppError('Transfer is not pending approval', 400);

  transfer.status = 'Approved';
  transfer.approvedBy = req.user?.id as any;
  await transfer.save();
  return sendResponse(res, 200, 'Transfer approved', transfer);
});

export const completeTransfer = asyncHandler(async (req: Request, res: Response) => {
  const transfer = await StockTransfer.findOne({
    _id: req.params.id,
    hospitalId: req.hospitalId,
  });
  if (!transfer) throw new AppError('Transfer not found', 404);
  if (!['Approved', 'Requested'].includes(transfer.status)) {
    throw new AppError('Transfer cannot be completed', 400);
  }

  for (const line of transfer.items) {
    await transferStockFefo({
      hospitalId: req.hospitalId,
      fromStoreId: String(transfer.fromStoreId),
      toStoreId: String(transfer.toStoreId),
      itemId: String(line.itemId),
      quantity: line.quantity,
      performedBy: req.user?.id,
      referenceType: 'TRANSFER',
      referenceId: transfer.transferNumber,
      remarks: transfer.remarks,
    });
  }

  transfer.status = 'Completed';
  if (!transfer.approvedBy) transfer.approvedBy = req.user?.id as any;
  await transfer.save();

  await logInventoryAction({
    hospitalId: req.hospitalId,
    userId: req.user?.id,
    action: 'TRANSFER_COMPLETE',
    entityType: 'StockTransfer',
    entityId: String(transfer._id),
    newValue: { transferNumber: transfer.transferNumber },
  });

  return sendResponse(res, 200, 'Transfer completed — stock moved', transfer);
});

/* ─── Purchase orders & GRN ─── */
export const createPurchaseOrder = asyncHandler(async (req: Request, res: Response) => {
  const { vendorId, storeId, expectedDelivery, items, tax } = req.body;
  if (!vendorId || !storeId || !items?.length) {
    throw new AppError('vendorId, storeId, and items are required', 400);
  }

  const subtotal = items.reduce(
    (s: number, i: any) => s + Number(i.quantity) * Number(i.unitPrice),
    0
  );
  const taxAmt = Number(tax) || 0;
  const poNumber = await nextDocNumber(req.hospitalId, PurchaseOrder, 'poNumber', 'PO');

  const po = await PurchaseOrder.create({
    hospitalId: req.hospitalId,
    poNumber,
    vendorId,
    storeId,
    expectedDelivery,
    items: items.map((i: any) => ({
      itemId: i.itemId,
      quantity: Number(i.quantity),
      unitPrice: Number(i.unitPrice),
      receivedQuantity: 0,
    })),
    subtotal,
    tax: taxAmt,
    total: subtotal + taxAmt,
    status: 'Ordered',
    createdBy: req.user?.id,
  });

  return sendResponse(res, 201, 'Purchase order created', po);
});

export const listPurchaseOrders = asyncHandler(async (req: Request, res: Response) => {
  const pos = await PurchaseOrder.find({ hospitalId: req.hospitalId })
    .populate('vendorId', 'name')
    .populate('storeId', 'name')
    .populate('items.itemId', 'name itemCode')
    .sort({ createdAt: -1 })
    .limit(100);
  return sendResponse(res, 200, 'Purchase orders retrieved', pos);
});

export const createGoodsReceipt = asyncHandler(async (req: Request, res: Response) => {
  const { storeId, vendorId, purchaseOrderId, invoiceNumber, receivedItems } = req.body;
  if (!storeId || !receivedItems?.length) {
    throw new AppError('storeId and receivedItems are required', 400);
  }

  const result = await receiveGoods({
    hospitalId: req.hospitalId,
    storeId,
    vendorId,
    purchaseOrderId,
    invoiceNumber,
    receivedBy: req.user?.id,
    receivedItems,
  });

  return sendResponse(res, 201, 'Goods received — batches created', result);
});

/* ─── Adjustments ─── */
export const adjustBatchStock = asyncHandler(async (req: Request, res: Response) => {
  const { batchId, newQuantity, reason } = req.body;
  if (!batchId || newQuantity === undefined) {
    throw new AppError('batchId and newQuantity are required', 400);
  }

  const batch = await InventoryBatch.findOne({ _id: batchId, hospitalId: req.hospitalId });
  if (!batch) throw new AppError('Batch not found', 404);

  const oldQty = batch.availableQuantity;
  const next = Number(newQuantity);
  if (next < 0) throw new AppError('Quantity cannot be negative', 400);

  const delta = next - oldQty;
  batch.availableQuantity = next;
  batch.quantity = next + (batch.reservedQuantity || 0);
  await batch.save();

  await StockTransaction.create({
    hospitalId: req.hospitalId,
    itemId: batch.itemId,
    batchId: batch._id,
    fromStoreId: delta < 0 ? batch.storeId : undefined,
    toStoreId: delta > 0 ? batch.storeId : undefined,
    transactionType: 'ADJUSTMENT',
    quantity: Math.abs(delta),
    unitCost: batch.purchasePrice,
    remarks: reason || 'Stock adjustment',
    performedBy: req.user?.id,
  });

  await logInventoryAction({
    hospitalId: req.hospitalId,
    userId: req.user?.id,
    action: 'ADJUSTMENT',
    entityType: 'InventoryBatch',
    entityId: String(batch._id),
    oldValue: { availableQuantity: oldQty },
    newValue: { availableQuantity: next, reason },
  });

  return sendResponse(res, 200, 'Stock adjusted', batch);
});

/* ─── Dashboard / alerts / analytics ─── */
export const getDashboard = asyncHandler(async (req: Request, res: Response) => {
  const data = await getDashboardMetrics(req.hospitalId);
  return sendResponse(res, 200, 'Inventory dashboard', data);
});

export const getExpiry = asyncHandler(async (req: Request, res: Response) => {
  const data = await getExpiryAlerts(req.hospitalId);
  return sendResponse(res, 200, 'Expiry alerts', data);
});

export const getLowStock = asyncHandler(async (req: Request, res: Response) => {
  const stock = await getStockByStore(req.hospitalId);
  const low = stock.filter((r: any) => r.isLow || r.quantity === 0);
  return sendResponse(res, 200, 'Low stock items', low);
});

export const getTransactions = asyncHandler(async (req: Request, res: Response) => {
  const filter: any = { hospitalId: req.hospitalId };
  if (req.query.type) filter.transactionType = req.query.type;
  if (req.query.itemId) filter.itemId = req.query.itemId;
  if (req.query.patientId) filter.patientId = req.query.patientId;

  const txns = await StockTransaction.find(filter)
    .populate('itemId', 'name itemCode')
    .populate('batchId', 'batchNumber expiryDate')
    .populate('fromStoreId', 'name')
    .populate('toStoreId', 'name')
    .populate('patientId', 'name patientId')
    .sort({ createdAt: -1 })
    .limit(100);

  return sendResponse(res, 200, 'Stock ledger', txns);
});

export const getReports = asyncHandler(async (req: Request, res: Response) => {
  const hospitalId = oid(req.hospitalId);
  const since = new Date(Date.now() - 90 * 86400000);

  const [fastMoving, slowMoving, deptConsumption, vendorPerf] = await Promise.all([
    StockTransaction.aggregate([
      {
        $match: {
          hospitalId,
          transactionType: 'CONSUMPTION',
          createdAt: { $gte: since },
        },
      },
      { $group: { _id: '$itemId', qty: { $sum: '$quantity' }, value: { $sum: { $multiply: ['$quantity', '$unitCost'] } } } },
      { $sort: { qty: -1 } },
      { $limit: 20 },
      {
        $lookup: {
          from: 'inventory_items',
          localField: '_id',
          foreignField: '_id',
          as: 'item',
        },
      },
      { $unwind: '$item' },
      { $project: { name: '$item.name', itemCode: '$item.itemCode', qty: 1, value: 1 } },
    ]),
    CatalogItem.aggregate([
      { $match: { hospitalId, isActive: true } },
      {
        $lookup: {
          from: 'stock_transactions',
          let: { iid: '$_id' },
          pipeline: [
            {
              $match: {
                $expr: {
                  $and: [
                    { $eq: ['$itemId', '$$iid'] },
                    { $eq: ['$transactionType', 'CONSUMPTION'] },
                    { $gte: ['$createdAt', since] },
                  ],
                },
              },
            },
            { $group: { _id: null, qty: { $sum: '$quantity' } } },
          ],
          as: 'usage',
        },
      },
      { $addFields: { usageQty: { $ifNull: [{ $arrayElemAt: ['$usage.qty', 0] }, 0] } } },
      { $match: { usageQty: { $lte: 5 } } },
      { $project: { name: 1, itemCode: 1, usageQty: 1 } },
      { $sort: { usageQty: 1 } },
      { $limit: 20 },
    ]),
    StockTransaction.aggregate([
      {
        $match: {
          hospitalId,
          transactionType: 'CONSUMPTION',
          departmentId: { $exists: true, $ne: null },
          createdAt: { $gte: since },
        },
      },
      { $group: { _id: '$departmentId', qty: { $sum: '$quantity' }, value: { $sum: { $multiply: ['$quantity', '$unitCost'] } } } },
      { $sort: { value: -1 } },
    ]),
    PurchaseOrder.aggregate([
      { $match: { hospitalId } },
      {
        $group: {
          _id: '$vendorId',
          orders: { $sum: 1 },
          total: { $sum: '$total' },
          received: { $sum: { $cond: [{ $eq: ['$status', 'Received'] }, 1, 0] } },
        },
      },
      {
        $lookup: {
          from: 'vendors',
          localField: '_id',
          foreignField: '_id',
          as: 'vendor',
        },
      },
      { $unwind: { path: '$vendor', preserveNullAndEmptyArrays: true } },
      {
        $project: {
          name: '$vendor.name',
          orders: 1,
          total: 1,
          received: 1,
          onTimeRate: {
            $cond: [{ $eq: ['$orders', 0] }, 0, { $multiply: [{ $divide: ['$received', '$orders'] }, 100] }],
          },
        },
      },
    ]),
  ]);

  return sendResponse(res, 200, 'Inventory reports', {
    fastMoving,
    slowMoving,
    departmentConsumption: deptConsumption,
    vendorPerformance: vendorPerf,
  });
});

/* ─── Enhanced vendors ─── */
export const addSmartVendor = asyncHandler(async (req: Request, res: Response) => {
  const { name, contactPerson, phone, email, address, gstNumber, paymentTerms } = req.body;
  if (!name) throw new AppError('Vendor name is required', 400);
  const vendor = await Vendor.create({
    hospitalId: req.hospitalId,
    name,
    contactPerson,
    phone,
    email,
    address,
    gstNumber,
    paymentTerms,
    isActive: true,
  });
  return sendResponse(res, 201, 'Vendor added', vendor);
});

/**
 * POST /inventory/receive
 * Manufacturer barcode receive → find/create item → create batch
 */
export const receiveByBarcodeHandler = asyncHandler(async (req: Request, res: Response) => {
  const {
    barcode,
    storeId,
    batchNumber,
    quantity,
    purchasePrice,
    sellingPrice,
    mrp,
    expiryDate,
    vendorId,
    name,
    unit,
    manufacturer,
    categoryId,
    reorderLevel,
    gstRate,
    invoiceNumber,
  } = req.body;

  if (!barcode || !storeId || !batchNumber || !quantity) {
    throw new AppError('barcode, storeId, batchNumber, and quantity are required', 400);
  }

  const result = await receiveByBarcode({
    hospitalId: req.hospitalId,
    barcode: String(barcode).trim(),
    storeId,
    batchNumber: String(batchNumber).trim(),
    quantity: Number(quantity),
    purchasePrice: Number(purchasePrice) || 0,
    sellingPrice: sellingPrice != null ? Number(sellingPrice) : undefined,
    mrp: mrp != null ? Number(mrp) : undefined,
    expiryDate,
    vendorId,
    name,
    unit,
    manufacturer,
    categoryId,
    reorderLevel,
    gstRate,
    invoiceNumber,
    receivedBy: req.user?.id,
  });

  return sendResponse(
    res,
    result.createdItem ? 201 : 200,
    result.createdItem
      ? 'New item created from barcode and batch received'
      : 'Stock received against manufacturer barcode',
    result
  );
});

/**
 * POST /inventory/scan
 * Nurse: patient QR + product barcode → FEFO consume + auto bill
 */
export const inventoryScanHandler = asyncHandler(async (req: Request, res: Response) => {
  const {
    wristband,
    patientId,
    admissionId,
    barcode,
    itemId,
    storeId,
    quantity = 1,
    billPatient = true,
    remarks,
  } = req.body;

  if (!storeId) throw new AppError('storeId is required', 400);
  if (!wristband && !patientId) throw new AppError('wristband or patientId is required', 400);
  if (!barcode && !itemId) throw new AppError('barcode or itemId is required', 400);

  const result = await scanConsume({
    hospitalId: req.hospitalId,
    wristband,
    patientId,
    admissionId,
    barcode,
    itemId,
    storeId,
    quantity: Number(quantity) || 1,
    billPatient,
    performedBy: req.user?.id,
    remarks: remarks || 'Nurse barcode scan',
  });

  return sendResponse(res, 200, 'Scanned — inventory deducted and patient billed', result);
});

/**
 * POST /inventory/scan/session
 * Commit multiple cart lines in one nurse session
 */
export const inventoryScanSessionHandler = asyncHandler(async (req: Request, res: Response) => {
  const {
    wristband,
    patientId,
    admissionId,
    storeId,
    items,
    billPatient = true,
  } = req.body;

  if (!storeId) throw new AppError('storeId is required', 400);
  if (!wristband && !patientId) throw new AppError('wristband or patientId is required', 400);
  if (!items?.length) throw new AppError('items array is required', 400);

  const results: any[] = [];
  const errors: string[] = [];

  for (const line of items) {
    try {
      const result = await scanConsume({
        hospitalId: req.hospitalId,
        wristband,
        patientId,
        admissionId,
        barcode: line.barcode,
        itemId: line.itemId,
        storeId,
        quantity: Number(line.quantity) || 1,
        billPatient,
        performedBy: req.user?.id,
        remarks: 'Nurse scan session',
      });
      results.push({
        barcode: line.barcode,
        itemName: result.item?.name,
        quantity: line.quantity,
        deductions: result.deductions,
        invoiceId: result.invoice?._id,
      });
    } catch (err: any) {
      errors.push(`${line.barcode || line.itemId}: ${err.message || 'failed'}`);
    }
  }

  if (!results.length) {
    throw new AppError(`Session failed: ${errors.join('; ')}`, 400);
  }

  return sendResponse(res, 200, 'Scan session completed', { results, errors });
});

/** Alias for procedure apply under inventory path */
export const inventoryApplyProcedureHandler = asyncHandler(async (req: Request, res: Response) => {
  const {
    templateId,
    storeId,
    wristband,
    patientId,
    admissionId,
    billPatient = true,
  } = req.body;
  if (!templateId || !storeId) throw new AppError('templateId and storeId are required', 400);

  const result = await applyProcedureTemplate({
    hospitalId: req.hospitalId,
    templateId,
    storeId,
    wristband,
    patientId,
    admissionId,
    billPatient,
    performedBy: req.user?.id,
  });

  return sendResponse(res, 200, 'Procedure applied — stock deducted and billed', result);
});

export const patientConsumptionHandler = asyncHandler(async (req: Request, res: Response) => {
  const patientId = (req.params.patientId || req.query.patientId) as string | undefined;
  const admissionId = req.query.admissionId as string | undefined;
  const days = req.query.days ? Number(req.query.days) : undefined;

  const data = await getPatientConsumption(req.hospitalId, { patientId, admissionId, days });
  return sendResponse(res, 200, 'Patient consumption', data);
});
