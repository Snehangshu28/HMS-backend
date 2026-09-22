"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getSalesLog = exports.sellMedicines = exports.getMedicines = exports.addMedicine = void 0;
const models_1 = require("./models");
const common_1 = require("../../common");
// @desc    Add or restock medicine inventory
// @route   POST /api/v1/pharmacy/inventory
// @access  Private (Pharmacist, Hospital Admin)
exports.addMedicine = (0, common_1.asyncHandler)(async (req, res) => {
    const { name, genericName, category, sku, manufacturer, price, stock, reorderLevel, batches } = req.body;
    if (!name || !category || !sku || !price || !price.purchasePrice || !price.salesPrice) {
        throw new common_1.AppError('Name, category, SKU, purchase price, and sales price are required', 400);
    }
    let medicine = await models_1.Medicine.findOne({ sku, hospitalId: req.hospitalId });
    if (medicine) {
        medicine.stock += Number(stock || 0);
        if (batches && batches.length) {
            medicine.batches.push(...batches);
        }
        await medicine.save();
    }
    else {
        medicine = await models_1.Medicine.create({
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
    return (0, common_1.sendResponse)(res, 201, 'Medicine added/restocked successfully', medicine);
});
// @desc    Get pharmacy stock catalog
// @route   GET /api/v1/pharmacy/inventory
// @access  Private (Pharmacist, Doctor, Nurse)
exports.getMedicines = (0, common_1.asyncHandler)(async (req, res) => {
    const { search } = req.query;
    const query = { hospitalId: req.hospitalId };
    if (search) {
        query.$or = [
            { name: { $regex: search, $options: 'i' } },
            { genericName: { $regex: search, $options: 'i' } },
            { sku: { $regex: search, $options: 'i' } }
        ];
    }
    const medicines = await models_1.Medicine.find(query).sort({ name: 1 });
    return (0, common_1.sendResponse)(res, 200, 'Medicines retrieved successfully', medicines);
});
// @desc    Checkout sales basket and deduct stock
// @route   POST /api/v1/pharmacy/sales
// @access  Private (Pharmacist)
exports.sellMedicines = (0, common_1.asyncHandler)(async (req, res) => {
    const { prescriptionId, patientId, items, paymentMode } = req.body;
    if (!items || !items.length || !paymentMode) {
        throw new common_1.AppError('Checkout items and payment mode are required', 400);
    }
    const hospitalId = req.hospitalId;
    let subtotal = 0;
    // Validate quantities and update stock batches
    for (const item of items) {
        const medicine = await models_1.Medicine.findOne({ _id: item.medicineId, hospitalId });
        if (!medicine) {
            throw new common_1.AppError(`Medicine with ID ${item.medicineId} not found`, 404);
        }
        if (medicine.stock < item.quantity) {
            throw new common_1.AppError(`Insufficient stock for ${medicine.name}. Available: ${medicine.stock}`, 400);
        }
        medicine.stock -= item.quantity;
        // First-Expiry-First-Out batch deduction
        let remainingToDeduct = item.quantity;
        medicine.batches.sort((a, b) => new Date(a.expiryDate).getTime() - new Date(b.expiryDate).getTime());
        for (const batch of medicine.batches) {
            if (remainingToDeduct <= 0)
                break;
            if (batch.quantity >= remainingToDeduct) {
                batch.quantity -= remainingToDeduct;
                remainingToDeduct = 0;
            }
            else {
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
    const sale = await models_1.MedicineSale.create({
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
    return (0, common_1.sendResponse)(res, 201, 'Medicine sale completed successfully', sale);
});
// @desc    Get pharmacy transaction logs
// @route   GET /api/v1/pharmacy/sales
// @access  Private (Pharmacist, Accountant)
exports.getSalesLog = (0, common_1.asyncHandler)(async (req, res) => {
    const sales = await models_1.MedicineSale.find({ hospitalId: req.hospitalId })
        .populate('patientId', 'name patientId')
        .populate('items.medicineId', 'name genericName')
        .populate('soldBy', 'name')
        .sort({ createdAt: -1 });
    return (0, common_1.sendResponse)(res, 200, 'Sales logs retrieved successfully', sales);
});
