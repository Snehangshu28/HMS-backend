import { Request, Response } from 'express';
import { InventoryItem, Vendor } from './models';
import { AppError, asyncHandler, sendResponse } from '../../common';

export const addInventoryItem = asyncHandler(async (req: Request, res: Response) => {
  const { name, sku, category, quantity, reorderLevel, status, vendorId } = req.body;

  if (!name || !sku || !category || quantity === undefined) {
    throw new AppError('Name, SKU, category, and quantity are required', 400);
  }

  let item = await InventoryItem.findOne({ sku, hospitalId: req.hospitalId });

  if (item) {
    item.quantity += Number(quantity);
    if (status) item.status = status;
    if (reorderLevel !== undefined) item.reorderLevel = Number(reorderLevel);
    if (vendorId) item.vendorId = vendorId;
    await item.save();
  } else {
    item = await InventoryItem.create({
      hospitalId: req.hospitalId,
      name,
      sku,
      category,
      quantity,
      reorderLevel,
      status,
      vendorId,
    });
  }

  return sendResponse(res, 201, 'Inventory asset logged successfully', item);
});

export const getInventoryItems = asyncHandler(async (req: Request, res: Response) => {
  const items = await InventoryItem.find({ hospitalId: req.hospitalId })
    .populate('vendorId', 'name contactPerson phone')
    .sort({ name: 1 });

  const lowStock = items.filter((i) => i.quantity <= (i.reorderLevel ?? 5));

  return sendResponse(res, 200, 'Inventory items retrieved successfully', {
    items,
    summary: {
      totalSkus: items.length,
      lowStockCount: lowStock.length,
      maintenanceCount: items.filter((i) => i.status === 'Under Maintenance').length,
      brokenCount: items.filter((i) => i.status === 'Broken').length,
    },
  });
});

export const updateInventoryItem = asyncHandler(async (req: Request, res: Response) => {
  const { id } = req.params;
  const { name, category, reorderLevel, status, vendorId, quantity } = req.body;

  const item = await InventoryItem.findOne({ _id: id, hospitalId: req.hospitalId });
  if (!item) throw new AppError('Inventory item not found', 404);

  if (name !== undefined) item.name = name;
  if (category !== undefined) item.category = category;
  if (reorderLevel !== undefined) item.reorderLevel = Number(reorderLevel);
  if (status !== undefined) item.status = status;
  if (vendorId !== undefined) item.vendorId = vendorId || undefined;
  if (quantity !== undefined) item.quantity = Number(quantity);

  await item.save();
  return sendResponse(res, 200, 'Inventory item updated', item);
});

export const adjustInventoryStock = asyncHandler(async (req: Request, res: Response) => {
  const { id } = req.params;
  const { delta, reason } = req.body;

  if (delta === undefined || Number.isNaN(Number(delta))) {
    throw new AppError('Stock adjustment delta is required (positive to restock, negative to consume)', 400);
  }

  const item = await InventoryItem.findOne({ _id: id, hospitalId: req.hospitalId });
  if (!item) throw new AppError('Inventory item not found', 404);

  const next = item.quantity + Number(delta);
  if (next < 0) {
    throw new AppError(`Insufficient stock. Available: ${item.quantity}`, 400);
  }

  item.quantity = next;
  await item.save();

  return sendResponse(res, 200, 'Stock adjusted', { item, reason: reason || null });
});

export const addVendor = asyncHandler(async (req: Request, res: Response) => {
  const { name, contactPerson, phone, email, address } = req.body;

  if (!name) {
    throw new AppError('Vendor name is required', 400);
  }

  const vendor = await Vendor.create({
    hospitalId: req.hospitalId,
    name,
    contactPerson,
    phone,
    email,
    address,
  });

  return sendResponse(res, 201, 'Vendor added successfully', vendor);
});

export const getVendors = asyncHandler(async (req: Request, res: Response) => {
  const vendors = await Vendor.find({ hospitalId: req.hospitalId }).sort({ name: 1 });
  return sendResponse(res, 200, 'Vendors list retrieved', vendors);
});

export const updateVendor = asyncHandler(async (req: Request, res: Response) => {
  const { id } = req.params;
  const vendor = await Vendor.findOneAndUpdate(
    { _id: id, hospitalId: req.hospitalId },
    req.body,
    { new: true, runValidators: true }
  );
  if (!vendor) throw new AppError('Vendor not found', 404);
  return sendResponse(res, 200, 'Vendor updated', vendor);
});
