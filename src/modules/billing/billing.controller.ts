import { Request, Response } from 'express';
import { Invoice, Payment, InsuranceClaim } from './models';
import {
  appendChargesToPatientBill,
  applyPatientPayment,
  buildPatientLedger,
  paidAmountForInvoice,
  refreshInvoiceStatus,
} from './billing.service';
import { AppError, asyncHandler, sendResponse } from '../../common';

const processItems = (items: any[]) => {
  let subtotal = 0;
  let taxTotal = 0;
  const processedItems = items.map((item: any) => {
    const quantity = item.quantity || 1;
    const unitPrice = item.unitPrice;
    const taxRate = item.taxRate || 0;
    const taxAmount = unitPrice * quantity * (taxRate / 100);
    const totalPrice = unitPrice * quantity + taxAmount;
    subtotal += unitPrice * quantity;
    taxTotal += taxAmount;
    return {
      description: item.description,
      category: item.category,
      quantity,
      unitPrice,
      taxRate,
      taxAmount,
      totalPrice,
    };
  });
  return { processedItems, subtotal, taxTotal, grandTotal: subtotal + taxTotal };
};

/** Add charges into the patient's single open bill store (preferred) */
export const createInvoice = asyncHandler(async (req: Request, res: Response) => {
  const { patientId, items, discountAmount = 0, dueDate, forceNew } = req.body;

  if (!patientId || !items || !items.length) {
    throw new AppError('Patient ID and billing items are required', 400);
  }

  const hospitalId = req.hospitalId!;

  // Default: append into one patient bill store
  if (!forceNew) {
    const invoice = await appendChargesToPatientBill(
      hospitalId,
      patientId,
      items.map((item: any) => ({
        description: item.description,
        category: item.category,
        quantity: item.quantity || 1,
        unitPrice: item.unitPrice,
        taxRate: item.taxRate || 0,
      }))
    );
    if (discountAmount && invoice) {
      invoice.discountAmount = (invoice.discountAmount || 0) + Number(discountAmount);
      invoice.grandTotal = invoice.subtotal + invoice.taxTotal - invoice.discountAmount;
      await invoice.save();
    }
    return sendResponse(res, 201, 'Charges added to patient bill', invoice);
  }

  const { processedItems, subtotal, taxTotal } = processItems(items);
  const grandTotal = subtotal + taxTotal - discountAmount;
  const invoice = await Invoice.create({
    hospitalId,
    patientId,
    items: processedItems,
    subtotal,
    taxTotal,
    discountAmount,
    grandTotal,
    dueDate: dueDate ? new Date(dueDate) : new Date(Date.now() + 7 * 86400000),
    paymentStatus: 'Unpaid',
  });

  return sendResponse(res, 201, 'Invoice generated successfully', invoice);
});

export const getInvoices = asyncHandler(async (req: Request, res: Response) => {
  const { patientId } = req.query;
  const query: any = { hospitalId: req.hospitalId };
  if (patientId) query.patientId = patientId;

  const invoices = await Invoice.find(query)
    .populate('patientId', 'name patientId contact.phone')
    .sort({ createdAt: -1 });

  const withBalance = await Promise.all(
    invoices.map(async (inv) => {
      const paidAmount = await paidAmountForInvoice(inv._id);
      return {
        ...inv.toObject(),
        paidAmount,
        balanceDue: Math.max(0, (inv.grandTotal || 0) - paidAmount),
      };
    })
  );

  return sendResponse(res, 200, 'Invoices retrieved successfully', withBalance);
});

/** Patient bill stores: grouped totals for Billing desk */
export const getPatientLedgers = asyncHandler(async (req: Request, res: Response) => {
  const hospitalId = req.hospitalId!;
  const invoices = await Invoice.find({ hospitalId })
    .populate('patientId', 'name patientId contact.phone')
    .sort({ updatedAt: -1 });

  const map = new Map<string, any>();

  for (const inv of invoices) {
    const patient: any = inv.patientId;
    const pid = String(patient?._id || inv.patientId);
    const paid = await paidAmountForInvoice(inv._id);
    if (!map.has(pid)) {
      map.set(pid, {
        patientId: pid,
        patient,
        totalBilled: 0,
        totalPaid: 0,
        balanceDue: 0,
        invoiceCount: 0,
        openInvoiceId: null as string | null,
        latestInvoiceNumber: inv.invoiceNumber,
        updatedAt: inv.updatedAt,
      });
    }
    const row = map.get(pid);
    row.totalBilled += inv.grandTotal || 0;
    row.totalPaid += paid;
    row.invoiceCount += 1;
    if (['Unpaid', 'Partially-Paid'].includes(inv.paymentStatus)) {
      row.openInvoiceId = inv._id;
    }
  }

  const ledgers = Array.from(map.values()).map((r) => ({
    ...r,
    balanceDue: Math.max(0, r.totalBilled - r.totalPaid),
  }));

  ledgers.sort((a, b) => b.balanceDue - a.balanceDue || b.totalBilled - a.totalBilled);

  return sendResponse(res, 200, 'Patient bill stores retrieved', ledgers);
});

export const getPatientLedger = asyncHandler(async (req: Request, res: Response) => {
  const { patientId } = req.params;
  const ledger = await buildPatientLedger(req.hospitalId, patientId);
  const { Patient } = await import('../patients/models');
  const patient = await Patient.findOne({ _id: patientId, hospitalId: req.hospitalId }).select(
    'name patientId contact.phone'
  );
  return sendResponse(res, 200, 'Patient bill store retrieved', {
    ...ledger,
    patient,
  });
});

/** Partial or full payment against patient bill store */
export const payPatientBill = asyncHandler(async (req: Request, res: Response) => {
  const { patientId } = req.params;
  const {
    amount,
    paymentMethod = 'Cash',
    transactionId,
    discountAmount,
    discountPercent,
    fullPay,
  } = req.body;

  if (!paymentMethod) {
    throw new AppError('Payment method is required', 400);
  }

  try {
    const result = await applyPatientPayment({
      hospitalId: req.hospitalId,
      patientId,
      amount: Number(amount) || 0,
      paymentMethod,
      transactionId,
      discountAmount: Number(discountAmount) || 0,
      discountPercent: Number(discountPercent) || 0,
      fullPay: Boolean(fullPay),
    });
    const ledger = await buildPatientLedger(req.hospitalId, patientId);
    return sendResponse(res, 201, 'Payment applied to patient bill', { ...result, ledger });
  } catch (err: any) {
    throw new AppError(err.message || 'Payment failed', 400);
  }
});

export const recordPayment = asyncHandler(async (req: Request, res: Response) => {
  const { invoiceId, patientId, amount, paymentMethod, transactionId } = req.body;

  if (!amount || !paymentMethod) {
    throw new AppError('Payment amount and payment method are required', 400);
  }

  // Prefer patient-level partial pay when patientId given
  if (patientId && !invoiceId) {
    try {
      const result = await applyPatientPayment({
        hospitalId: req.hospitalId,
        patientId,
        amount: Number(amount),
        paymentMethod,
        transactionId,
      });
      return sendResponse(res, 201, 'Payment recorded on patient bill', result);
    } catch (err: any) {
      throw new AppError(err.message || 'Payment failed', 400);
    }
  }

  if (!invoiceId) {
    throw new AppError('Invoice ID or patient ID is required', 400);
  }

  const invoice = await Invoice.findOne({ _id: invoiceId, hospitalId: req.hospitalId });
  if (!invoice) throw new AppError('Invoice not found', 404);

  const alreadyPaid = await paidAmountForInvoice(invoice._id);
  const due = Math.max(0, invoice.grandTotal - alreadyPaid);
  const payAmount = Number(amount);
  if (payAmount <= 0) throw new AppError('Amount must be greater than 0', 400);
  if (payAmount > due + 0.01) {
    throw new AppError(`Amount exceeds balance due of ₹${due}`, 400);
  }

  const count = await Payment.countDocuments({ hospitalId: req.hospitalId });
  const payment = await Payment.create({
    hospitalId: req.hospitalId,
    invoiceId,
    paymentNumber: `PMT-${(count + 10001).toString()}`,
    amount: payAmount,
    paymentMethod,
    transactionId,
    status: 'Success',
  });

  const status = await refreshInvoiceStatus(invoice);

  return sendResponse(res, 201, 'Payment recorded successfully', {
    payment,
    invoiceStatus: status.status,
    paidAmount: status.paid,
    balanceDue: status.due,
  });
});

export const fileInsuranceClaim = asyncHandler(async (req: Request, res: Response) => {
  const { invoiceId, patientId, provider, policyNumber, claimedAmount } = req.body;

  if (!invoiceId || !patientId || !provider || !policyNumber || !claimedAmount) {
    throw new AppError('Missing details to file insurance claims', 400);
  }

  const claim = await InsuranceClaim.create({
    hospitalId: req.hospitalId,
    invoiceId,
    patientId,
    provider,
    policyNumber,
    claimedAmount,
  });

  return sendResponse(res, 201, 'Insurance claim filed successfully', claim);
});
