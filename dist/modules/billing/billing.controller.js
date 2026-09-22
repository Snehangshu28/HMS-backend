"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.fileInsuranceClaim = exports.recordPayment = exports.getInvoices = exports.createInvoice = void 0;
const models_1 = require("./models");
const common_1 = require("../../common");
// @desc    Generate a new patient invoice
// @route   POST /api/v1/billing/invoices
// @access  Private (Accountant)
exports.createInvoice = (0, common_1.asyncHandler)(async (req, res) => {
    const { patientId, items, discountAmount = 0, dueDate } = req.body;
    if (!patientId || !items || !items.length || !dueDate) {
        throw new common_1.AppError('Patient ID, billing items, and due date are required', 400);
    }
    const hospitalId = req.hospitalId;
    let subtotal = 0;
    let taxTotal = 0;
    // Process items and calculate taxes (GST)
    const processedItems = items.map((item) => {
        const quantity = item.quantity || 1;
        const unitPrice = item.unitPrice;
        const taxRate = item.taxRate || 0;
        const taxAmount = (unitPrice * quantity) * (taxRate / 100);
        const totalPrice = (unitPrice * quantity) + taxAmount;
        subtotal += unitPrice * quantity;
        taxTotal += taxAmount;
        return {
            description: item.description,
            category: item.category,
            quantity,
            unitPrice,
            taxRate,
            taxAmount,
            totalPrice
        };
    });
    const grandTotal = (subtotal + taxTotal) - discountAmount;
    const invoice = await models_1.Invoice.create({
        hospitalId,
        patientId,
        items: processedItems,
        subtotal,
        taxTotal,
        discountAmount,
        grandTotal,
        dueDate: new Date(dueDate),
        paymentStatus: 'Unpaid'
    });
    return (0, common_1.sendResponse)(res, 201, 'Invoice generated successfully', invoice);
});
// @desc    List Invoices
// @route   GET /api/v1/billing/invoices
// @access  Private (Accountant, Hospital Admin)
exports.getInvoices = (0, common_1.asyncHandler)(async (req, res) => {
    const invoices = await models_1.Invoice.find({ hospitalId: req.hospitalId })
        .populate('patientId', 'name patientId')
        .sort({ createdAt: -1 });
    return (0, common_1.sendResponse)(res, 200, 'Invoices retrieved successfully', invoices);
});
// @desc    Record Invoice Payment
// @route   POST /api/v1/billing/payments
// @access  Private (Accountant)
exports.recordPayment = (0, common_1.asyncHandler)(async (req, res) => {
    const { invoiceId, amount, paymentMethod, transactionId } = req.body;
    if (!invoiceId || !amount || !paymentMethod) {
        throw new common_1.AppError('Invoice ID, payment amount, and payment method are required', 400);
    }
    const invoice = await models_1.Invoice.findOne({ _id: invoiceId, hospitalId: req.hospitalId });
    if (!invoice) {
        throw new common_1.AppError('Invoice not found', 404);
    }
    const count = await models_1.Payment.countDocuments({ hospitalId: req.hospitalId });
    const paymentNumber = `PMT-${(count + 10001).toString()}`;
    const payment = await models_1.Payment.create({
        hospitalId: req.hospitalId,
        invoiceId,
        paymentNumber,
        amount,
        paymentMethod,
        transactionId,
        status: 'Success'
    });
    // Calculate total successful payments for cascading status
    const totalPaid = await models_1.Payment.aggregate([
        { $match: { invoiceId: invoice._id, status: 'Success' } },
        { $group: { _id: '$invoiceId', total: { $sum: '$amount' } } }
    ]);
    const paidSum = totalPaid.length ? totalPaid[0].total : 0;
    if (paidSum >= invoice.grandTotal) {
        invoice.paymentStatus = 'Paid';
    }
    else if (paidSum > 0) {
        invoice.paymentStatus = 'Partially-Paid';
    }
    await invoice.save();
    return (0, common_1.sendResponse)(res, 201, 'Payment recorded successfully', { payment, invoiceStatus: invoice.paymentStatus });
});
// @desc    File Insurance Claim
// @route   POST /api/v1/billing/claims
// @access  Private (Accountant)
exports.fileInsuranceClaim = (0, common_1.asyncHandler)(async (req, res) => {
    const { invoiceId, patientId, provider, policyNumber, claimedAmount } = req.body;
    if (!invoiceId || !patientId || !provider || !policyNumber || !claimedAmount) {
        throw new common_1.AppError('Missing details to file insurance claims', 400);
    }
    const claim = await models_1.InsuranceClaim.create({
        hospitalId: req.hospitalId,
        invoiceId,
        patientId,
        provider,
        policyNumber,
        claimedAmount
    });
    return (0, common_1.sendResponse)(res, 201, 'Insurance claim filed successfully', claim);
});
