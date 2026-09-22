import { Invoice, Payment } from './models';

export type BillLineInput = {
  description: string;
  category: 'Consultation' | 'Lab Test' | 'Pharmacy' | 'IPD Ward' | 'ICU Bed' | 'Other';
  quantity?: number;
  unitPrice: number;
  taxRate?: number;
};

const processLines = (items: BillLineInput[]) => {
  let subtotal = 0;
  let taxTotal = 0;
  const processed = items.map((item) => {
    const quantity = item.quantity || 1;
    const unitPrice = Number(item.unitPrice) || 0;
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
  return { processed, subtotal, taxTotal };
};

/** One open patient bill store — append charges here so family sees a single running total */
export const getOrCreateOpenInvoice = async (hospitalId: any, patientId: any) => {
  let invoice = await Invoice.findOne({
    hospitalId,
    patientId,
    paymentStatus: { $in: ['Unpaid', 'Partially-Paid'] },
  }).sort({ createdAt: 1 });

  if (!invoice) {
    const dueDate = new Date();
    dueDate.setDate(dueDate.getDate() + 7);
    invoice = await Invoice.create({
      hospitalId,
      patientId,
      items: [],
      subtotal: 0,
      taxTotal: 0,
      discountAmount: 0,
      grandTotal: 0,
      dueDate,
      paymentStatus: 'Unpaid',
    });
  }

  return invoice;
};

export const appendChargesToPatientBill = async (
  hospitalId: any,
  patientId: any,
  items: BillLineInput[]
) => {
  if (!items.length) return null;

  const { processed, subtotal, taxTotal } = processLines(items);
  const invoice = await getOrCreateOpenInvoice(hospitalId, patientId);

  invoice.items.push(...(processed as any));
  invoice.markModified('items');
  invoice.subtotal = (invoice.subtotal || 0) + subtotal;
  invoice.taxTotal = (invoice.taxTotal || 0) + taxTotal;
  invoice.grandTotal = invoice.subtotal + invoice.taxTotal - (invoice.discountAmount || 0);
  if (invoice.paymentStatus === 'Paid') invoice.paymentStatus = 'Partially-Paid';
  await invoice.save();

  return invoice;
};

export const paidAmountForInvoice = async (invoiceId: any) => {
  const paidAgg = await Payment.aggregate([
    { $match: { invoiceId, status: 'Success' } },
    { $group: { _id: null, total: { $sum: '$amount' } } },
  ]);
  return paidAgg[0]?.total || 0;
};

export const refreshInvoiceStatus = async (invoice: any) => {
  const paid = await paidAmountForInvoice(invoice._id);
  if (paid <= 0) invoice.paymentStatus = 'Unpaid';
  else if (paid >= invoice.grandTotal) invoice.paymentStatus = 'Paid';
  else invoice.paymentStatus = 'Partially-Paid';
  await invoice.save();
  return { paid, due: Math.max(0, invoice.grandTotal - paid), status: invoice.paymentStatus };
};

/** Apply discount to open invoices (reduces grand total / due) */
export const applyDiscountToPatientBills = async (opts: {
  hospitalId: any;
  patientId: any;
  discountAmount?: number;
  discountPercent?: number;
}) => {
  const openInvoices = await Invoice.find({
    hospitalId: opts.hospitalId,
    patientId: opts.patientId,
    paymentStatus: { $in: ['Unpaid', 'Partially-Paid'] },
  }).sort({ createdAt: 1 });

  if (!openInvoices.length) return { discountApplied: 0 };

  let totalDue = 0;
  const dues: { inv: any; due: number }[] = [];
  for (const inv of openInvoices) {
    const paid = await paidAmountForInvoice(inv._id);
    const due = Math.max(0, inv.grandTotal - paid);
    if (due > 0) {
      dues.push({ inv, due });
      totalDue += due;
    }
  }
  if (totalDue <= 0) return { discountApplied: 0 };

  let discountWanted = 0;
  if (opts.discountPercent && opts.discountPercent > 0) {
    discountWanted = Math.round((totalDue * Number(opts.discountPercent)) / 100);
  }
  if (opts.discountAmount && opts.discountAmount > 0) {
    discountWanted = Math.max(discountWanted, Number(opts.discountAmount));
  }
  // If both provided intentionally as separate fields, prefer amount when percent is 0
  if (opts.discountAmount && opts.discountPercent) {
    // UI sends one mode; if both, use amount as absolute override when > 0 else percent
    discountWanted =
      Number(opts.discountAmount) > 0
        ? Number(opts.discountAmount)
        : Math.round((totalDue * Number(opts.discountPercent)) / 100);
  }

  discountWanted = Math.min(Math.max(0, discountWanted), totalDue);
  if (discountWanted <= 0) return { discountApplied: 0 };

  let left = discountWanted;
  for (const { inv, due } of dues) {
    if (left <= 0) break;
    const slice = Math.min(left, due);
    inv.discountAmount = (inv.discountAmount || 0) + slice;
    inv.grandTotal = Math.max(0, inv.subtotal + inv.taxTotal - inv.discountAmount);
    await inv.save();
    await refreshInvoiceStatus(inv);
    left -= slice;
  }

  return { discountApplied: discountWanted - left, totalDueBefore: totalDue };
};

/** Apply a payment to a patient's open bills (oldest first) */
export const applyPatientPayment = async (opts: {
  hospitalId: any;
  patientId: any;
  amount?: number;
  paymentMethod: string;
  transactionId?: string;
  discountAmount?: number;
  discountPercent?: number;
  fullPay?: boolean;
}) => {
  let discountMeta = { discountApplied: 0, totalDueBefore: 0 };
  if ((opts.discountAmount && opts.discountAmount > 0) || (opts.discountPercent && opts.discountPercent > 0)) {
    discountMeta = await applyDiscountToPatientBills({
      hospitalId: opts.hospitalId,
      patientId: opts.patientId,
      discountAmount: opts.discountAmount,
      discountPercent: opts.discountPercent,
    });
  }

  // After discount, resolve how much to collect
  const ledgerAfterDiscount = await buildPatientLedger(opts.hospitalId, opts.patientId);
  let amount = opts.fullPay
    ? ledgerAfterDiscount.balanceDue
    : Number(opts.amount) || 0;

  if (amount > ledgerAfterDiscount.balanceDue) {
    amount = ledgerAfterDiscount.balanceDue;
  }

  if (!amount || amount <= 0) {
    if (ledgerAfterDiscount.balanceDue <= 0) {
      return {
        requested: 0,
        appliedTotal: 0,
        leftover: 0,
        applied: [],
        discount: discountMeta,
        balanceDue: 0,
      };
    }
    throw new Error('Payment amount must be greater than 0');
  }

  const openInvoices = await Invoice.find({
    hospitalId: opts.hospitalId,
    patientId: opts.patientId,
    paymentStatus: { $in: ['Unpaid', 'Partially-Paid'] },
  }).sort({ createdAt: 1 });

  if (!openInvoices.length) throw new Error('No outstanding bill for this patient');

  let remaining = amount;
  const applied: { invoiceId: any; invoiceNumber?: string; amount: number; status: string }[] = [];

  for (const inv of openInvoices) {
    if (remaining <= 0) break;
    const alreadyPaid = await paidAmountForInvoice(inv._id);
    const due = Math.max(0, inv.grandTotal - alreadyPaid);
    if (due <= 0) {
      inv.paymentStatus = 'Paid';
      await inv.save();
      continue;
    }

    const payNow = Math.min(remaining, due);
    const count = await Payment.countDocuments({ hospitalId: opts.hospitalId });
    await Payment.create({
      hospitalId: opts.hospitalId,
      invoiceId: inv._id,
      paymentNumber: `PMT-${(count + 10001).toString()}`,
      amount: payNow,
      paymentMethod: opts.paymentMethod,
      transactionId: opts.transactionId,
      status: 'Success',
    });

    const status = await refreshInvoiceStatus(inv);
    applied.push({
      invoiceId: inv._id,
      invoiceNumber: inv.invoiceNumber,
      amount: payNow,
      status: status.status,
    });
    remaining -= payNow;
  }

  const ledger = await buildPatientLedger(opts.hospitalId, opts.patientId);

  return {
    requested: amount,
    appliedTotal: amount - remaining,
    leftover: remaining,
    applied,
    discount: discountMeta,
    balanceDue: ledger.balanceDue,
  };
};

export const buildPatientLedger = async (hospitalId: any, patientId: any) => {
  const invoices = await Invoice.find({ hospitalId, patientId }).sort({ createdAt: -1 });
  const payments = await Payment.find({
    hospitalId,
    invoiceId: { $in: invoices.map((i) => i._id) },
    status: 'Success',
  }).sort({ createdAt: -1 });

  let totalBilled = 0;
  let totalPaid = 0;
  const enriched = [];

  for (const inv of invoices) {
    const paid = await paidAmountForInvoice(inv._id);
    const due = Math.max(0, inv.grandTotal - paid);
    totalBilled += inv.grandTotal || 0;
    totalPaid += paid;
    enriched.push({
      ...inv.toObject(),
      paidAmount: paid,
      balanceDue: due,
    });
  }

  const allLines = enriched.flatMap((inv) =>
    (inv.items || []).map((item: any) => ({
      ...item,
      invoiceId: inv._id,
      invoiceNumber: inv.invoiceNumber,
      billedAt: inv.createdAt,
    }))
  );

  return {
    patientId,
    totalBilled,
    totalPaid,
    balanceDue: Math.max(0, totalBilled - totalPaid),
    invoices: enriched,
    payments,
    lines: allLines,
  };
};
