"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getVendors = exports.addVendor = exports.getInventoryItems = exports.addInventoryItem = void 0;
const models_1 = require("./models");
const common_1 = require("../../common");
// @desc    Add or restock inventory asset
// @route   POST /api/v1/inventory
// @access  Private (Hospital Admin, Pharmacist)
exports.addInventoryItem = (0, common_1.asyncHandler)(async (req, res) => {
    const { name, sku, category, quantity, reorderLevel, status, vendorId } = req.body;
    if (!name || !sku || !category || quantity === undefined) {
        throw new common_1.AppError('Name, SKU, category, and quantity are required', 400);
    }
    let item = await models_1.InventoryItem.findOne({ sku, hospitalId: req.hospitalId });
    if (item) {
        item.quantity += Number(quantity);
        if (status)
            item.status = status;
        await item.save();
    }
    else {
        item = await models_1.InventoryItem.create({
            hospitalId: req.hospitalId,
            name,
            sku,
            category,
            quantity,
            reorderLevel,
            status,
            vendorId
        });
    }
    return (0, common_1.sendResponse)(res, 201, 'Inventory asset logged successfully', item);
});
// @desc    Get Inventory Items
// @route   GET /api/v1/inventory
// @access  Private (Hospital Admin, Pharmacist, Nurse)
exports.getInventoryItems = (0, common_1.asyncHandler)(async (req, res) => {
    const items = await models_1.InventoryItem.find({ hospitalId: req.hospitalId })
        .populate('vendorId', 'name contactPerson phone')
        .sort({ name: 1 });
    return (0, common_1.sendResponse)(res, 200, 'Inventory items retrieved successfully', items);
});
// @desc    Add a Vendor supplier
// @route   POST /api/v1/inventory/vendors
// @access  Private (Hospital Admin)
exports.addVendor = (0, common_1.asyncHandler)(async (req, res) => {
    const { name, contactPerson, phone, email, address } = req.body;
    if (!name) {
        throw new common_1.AppError('Vendor name is required', 400);
    }
    const vendor = await models_1.Vendor.create({
        hospitalId: req.hospitalId,
        name,
        contactPerson,
        phone,
        email,
        address
    });
    return (0, common_1.sendResponse)(res, 201, 'Vendor added successfully', vendor);
});
// @desc    Get Vendors list
// @route   GET /api/v1/inventory/vendors
// @access  Private (Hospital Admin)
exports.getVendors = (0, common_1.asyncHandler)(async (req, res) => {
    const vendors = await models_1.Vendor.find({ hospitalId: req.hospitalId }).sort({ name: 1 });
    return (0, common_1.sendResponse)(res, 200, 'Vendors list retrieved', vendors);
});
