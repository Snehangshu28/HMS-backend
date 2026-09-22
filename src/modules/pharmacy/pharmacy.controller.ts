import { Request, Response } from 'express';
import { Medicine, MedicineSale } from './models';
import { appendChargesToPatientBill } from '../billing/billing.service';
import { AppError, asyncHandler, sendResponse } from '../../common';

// @desc    Add or restock medicine inventory
// @route   POST /api/v1/pharmacy/inventory
// @access  Private (Pharmacist, Hospital Admin)
export const addMedicine = asyncHandler(async (req: Request, res: Response) => {
  const { name, genericName, category, sku, manufacturer, price, stock, reorderLevel, batches } = req.body;

  if (!name || !category || !sku || !price || !price.purchasePrice || !price.salesPrice) {
    throw new AppError('Name, category, SKU, purchase price, and sales price are required', 400);
  }

  let medicine = await Medicine.findOne({ sku, hospitalId: req.hospitalId });

  if (medicine) {
    medicine.stock += Number(stock || 0);
    if (batches && batches.length) {
      medicine.batches.push(...batches);
    }
    await medicine.save();
  } else {
    medicine = await Medicine.create({
      hospitalId: req.hospitalId,
      name,
      genericName,
      category,
      sku,
      manufacturer,
      price,
      stock: stock || 0,
      reorderLevel: reorderLevel || 20,
      batches: batches || []
    });
  }

  return sendResponse(res, 201, 'Medicine added/restocked successfully', medicine);
});

// @desc    Get pharmacy stock catalog
// @route   GET /api/v1/pharmacy/inventory
// @access  Private (Pharmacist, Doctor, Nurse)
export const getMedicines = asyncHandler(async (req: Request, res: Response) => {
  const { search } = req.query;

  const query: any = { hospitalId: req.hospitalId };

  if (search) {
    query.$or = [
      { name: { $regex: search, $options: 'i' } },
      { genericName: { $regex: search, $options: 'i' } },
      { sku: { $regex: search, $options: 'i' } }
    ];
  }

  const medicines = await Medicine.find(query).sort({ name: 1 });

  return sendResponse(res, 200, 'Medicines retrieved successfully', medicines);
});

// @desc    Checkout sales basket and deduct stock
// @route   POST /api/v1/pharmacy/sales
// @access  Private (Pharmacist)
export const sellMedicines = asyncHandler(async (req: Request, res: Response) => {
  const { prescriptionId, patientId, items, paymentMode } = req.body;

  if (!items || !items.length || !paymentMode) {
    throw new AppError('Checkout items and payment mode are required', 400);
  }

  const hospitalId = req.hospitalId!;
  let subtotal = 0;

  // Validate quantities and update stock batches
  for (const item of items) {
    const medicine = await Medicine.findOne({ _id: item.medicineId, hospitalId });
    if (!medicine) {
      throw new AppError(`Medicine with ID ${item.medicineId} not found`, 404);
    }

    if (medicine.stock < item.quantity) {
      throw new AppError(`Insufficient stock for ${medicine.name}. Available: ${medicine.stock}`, 400);
    }

    medicine.stock -= item.quantity;
    
    // First-Expiry-First-Out batch deduction
    let remainingToDeduct = item.quantity;
    medicine.batches.sort((a, b) => new Date(a.expiryDate).getTime() - new Date(b.expiryDate).getTime());

    for (const batch of medicine.batches) {
      if (remainingToDeduct <= 0) break;
      if (batch.quantity >= remainingToDeduct) {
        batch.quantity -= remainingToDeduct;
        remainingToDeduct = 0;
      } else {
        remainingToDeduct -= batch.quantity;
        batch.quantity = 0;
      }
    }

    medicine.batches = medicine.batches.filter(b => b.quantity > 0);
    await medicine.save();

    item.unitPrice = medicine.price.salesPrice;
    item.totalPrice = medicine.price.salesPrice * item.quantity;
    subtotal += item.totalPrice;
  }

  const tax = subtotal * 0.18; // 18% GST
  const grandTotal = subtotal + tax;

  const sale = await MedicineSale.create({
    hospitalId,
    prescriptionId,
    patientId,
    items,
    subtotal,
    tax,
    grandTotal,
    paymentMode,
    soldBy: req.user?.id
  });

  let invoice = null;
  if (patientId) {
    try {
      const billLines = [];
      for (const item of items) {
        const medicine = await Medicine.findById(item.medicineId);
        billLines.push({
          description: `${medicine?.name || 'Medicine'} (Pharmacy dispense)`,
          category: 'Pharmacy' as const,
          quantity: item.quantity,
          unitPrice: item.unitPrice,
          taxRate: 18,
        });
      }
      invoice = await appendChargesToPatientBill(hospitalId, patientId, billLines);
    } catch (billErr) {
      console.error('Failed to append pharmacy sale to patient bill', billErr);
    }
  }

  return sendResponse(res, 201, 'Medicine sale completed successfully', { sale, invoice });
});

// @desc    Get pharmacy transaction logs
// @route   GET /api/v1/pharmacy/sales
// @access  Private (Pharmacist, Accountant)
export const getSalesLog = asyncHandler(async (req: Request, res: Response) => {
  const sales = await MedicineSale.find({ hospitalId: req.hospitalId })
    .populate('patientId', 'name patientId')
    .populate('items.medicineId', 'name genericName')
    .populate('soldBy', 'name')
    .sort({ createdAt: -1 });

  return sendResponse(res, 200, 'Sales logs retrieved successfully', sales);
});
