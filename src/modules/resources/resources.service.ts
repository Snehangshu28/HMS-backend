import crypto from 'crypto';
import mongoose from 'mongoose';
import { AppError } from '../../common';
import { Admission } from '../ipd/models';
import { Patient } from '../patients/models';
import { CatalogItem, InventoryStore, StockTransaction } from '../inventory/models';
import { consumeFefo, ensureDefaultStores } from '../inventory/inventory.service';
import {
  BedChargeRate,
  DEFAULT_BED_RATES,
  DEFAULT_PROCEDURE_TEMPLATES,
  PatientResourceLedger,
  ProcedureTemplate,
  ReconciliationAlert,
  ResourceUsage,
} from './models';

const oid = (id: string | mongoose.Types.ObjectId) =>
  typeof id === 'string' ? new mongoose.Types.ObjectId(id) : id;

/** Wristband QR payload: HMS:ADM:<token> */
export const buildWristbandPayload = (token: string) => `HMS:ADM:${token}`;

export const parseWristbandPayload = (raw: string): string | null => {
  const value = String(raw || '').trim();
  if (!value) return null;
  if (value.startsWith('HMS:ADM:')) return value.slice('HMS:ADM:'.length);
  // Allow scanning raw token or admission number
  return value;
};

export const generateWristbandToken = () =>
  crypto.randomBytes(8).toString('hex').toUpperCase();

export const nextAdmissionNumber = async (hospitalId: any) => {
  const count = await Admission.countDocuments({ hospitalId });
  return `ADM-${String(count + 10001).padStart(5, '0')}`;
};

/** Create ledger + wristband fields when a patient is admitted */
export const createAdmissionResourceSetup = async (params: {
  hospitalId: any;
  admissionId: any;
  patientId: any;
}) => {
  const admission = await Admission.findById(params.admissionId);
  if (!admission) throw new AppError('Admission not found', 404);

  let wristbandToken = (admission as any).wristbandToken as string | undefined;
  let admissionNumber = (admission as any).admissionNumber as string | undefined;
  let wristbandPayload = (admission as any).wristbandPayload as string | undefined;

  if (!wristbandToken || !wristbandPayload) {
    wristbandToken = generateWristbandToken();
    wristbandPayload = buildWristbandPayload(wristbandToken);
    if (!admissionNumber) admissionNumber = await nextAdmissionNumber(params.hospitalId);

    await Admission.findByIdAndUpdate(params.admissionId, {
      $set: {
        admissionNumber,
        wristbandToken,
        wristbandPayload,
      },
    });
  }

  let ledger = await PatientResourceLedger.findOne({ admissionId: params.admissionId });
  if (!ledger) {
    ledger = await PatientResourceLedger.create({
      hospitalId: params.hospitalId,
      admissionId: params.admissionId,
      patientId: params.patientId,
      status: admission.status === 'Discharged' ? 'Closed' : 'Open',
      totalItems: 0,
      totalAmount: 0,
    });
  }

  await Patient.findByIdAndUpdate(params.patientId, {
    $set: { qrCodeUrl: wristbandPayload },
  });

  return {
    ledger,
    admissionNumber: admissionNumber!,
    wristbandToken: wristbandToken!,
    wristbandPayload: wristbandPayload!,
  };
};

export const closeAdmissionLedger = async (admissionId: any) => {
  await PatientResourceLedger.findOneAndUpdate(
    { admissionId, status: 'Open' },
    { $set: { status: 'Closed', closedAt: new Date() } }
  );
};

export const getOrCreateOpenLedger = async (params: {
  hospitalId: any;
  patientId: string;
  admissionId?: string;
}) => {
  if (params.admissionId) {
    let ledger = await PatientResourceLedger.findOne({
      hospitalId: params.hospitalId,
      admissionId: params.admissionId,
    });
    if (!ledger) {
      ledger = await PatientResourceLedger.create({
        hospitalId: params.hospitalId,
        admissionId: params.admissionId,
        patientId: params.patientId,
        status: 'Open',
      });
    }
    return ledger;
  }

  const active = await Admission.findOne({
    hospitalId: params.hospitalId,
    patientId: params.patientId,
    status: 'Admitted',
  });

  if (active) {
    let ledger = await PatientResourceLedger.findOne({ admissionId: active._id });
    if (!ledger) {
      ledger = await PatientResourceLedger.create({
        hospitalId: params.hospitalId,
        admissionId: active._id,
        patientId: params.patientId,
        status: 'Open',
      });
    }
    return ledger;
  }

  // OPD / walk-in: synthetic ledger keyed by a phantom admission is avoided —
  // create a patient-level open ledger without admission if needed via scan with patientId only
  let ledger = await PatientResourceLedger.findOne({
    hospitalId: params.hospitalId,
    patientId: params.patientId,
    status: 'Open',
    admissionId: { $exists: true },
  }).sort({ createdAt: -1 });

  if (!ledger) {
    // Create a temporary admission-less ledger using a placeholder ObjectId is messy;
    // require active admission for IPD resource tracking.
    throw new AppError('Patient has no active admission for resource tracking', 400);
  }

  return ledger;
};

export const resolveWristband = async (hospitalId: any, raw: string) => {
  const token = parseWristbandPayload(raw);
  if (!token) throw new AppError('Invalid wristband QR', 400);

  const admission = await Admission.findOne({
    hospitalId,
    status: 'Admitted',
    $or: [
      { wristbandToken: token },
      { admissionNumber: token },
      { wristbandPayload: buildWristbandPayload(token) },
    ],
  })
    .populate('patientId', 'name patientId contact.phone gender bloodGroup qrCodeUrl')
    .populate('wardId', 'name category')
    .populate('bedId', 'bedNumber type');

  if (!admission) throw new AppError('No active admission found for this wristband', 404);

  const ledger = await PatientResourceLedger.findOne({ admissionId: admission._id });

  return { admission, ledger, patient: admission.patientId };
};

/** Resolve catalog item by barcode, itemCode, or encoded payload ITEM|BATCH|EXP|PRICE */
export const resolveBarcode = async (hospitalId: any, raw: string) => {
  const code = String(raw || '').trim();
  if (!code) throw new AppError('Barcode is required', 400);

  let lookup = code;
  let encodedBatch: string | undefined;
  let encodedPrice: number | undefined;

  if (code.includes('|')) {
    const parts = code.split('|');
    lookup = parts[0];
    encodedBatch = parts[1] || undefined;
    if (parts[3]) encodedPrice = Number(parts[3]) || undefined;
  }

  const item = await CatalogItem.findOne({
    hospitalId,
    isActive: true,
    $or: [{ barcode: lookup }, { itemCode: lookup }, { barcode: code }, { itemCode: code }],
  }).populate('categoryId', 'name');

  if (!item) throw new AppError(`No inventory item found for barcode: ${lookup}`, 404);

  return { item, encodedBatch, encodedPrice, barcode: lookup };
};

const recordUsages = async (params: {
  hospitalId: any;
  ledger: any;
  patientId: any;
  admissionId?: any;
  source: 'SCAN' | 'TEMPLATE' | 'PHARMACY' | 'LAB' | 'BED' | 'MANUAL';
  deductions: { batchNumber: string; quantity: number; unitPrice: number }[];
  item: { _id: any; name: string; barcode?: string };
  storeId?: string;
  templateId?: string;
  templateName?: string;
  invoiceId?: any;
  performedBy?: string;
  remarks?: string;
  billed?: boolean;
}) => {
  const usages = [];
  let amount = 0;
  let qty = 0;

  for (const d of params.deductions) {
    const totalPrice = d.quantity * d.unitPrice;
    amount += totalPrice;
    qty += d.quantity;
    usages.push({
      hospitalId: params.hospitalId,
      ledgerId: params.ledger._id,
      admissionId: params.admissionId || params.ledger.admissionId,
      patientId: params.patientId,
      source: params.source,
      itemId: params.item._id,
      itemName: params.item.name,
      barcode: params.item.barcode,
      batchNumber: d.batchNumber,
      quantity: d.quantity,
      unitPrice: d.unitPrice,
      totalPrice,
      storeId: params.storeId,
      templateId: params.templateId,
      templateName: params.templateName,
      billed: params.billed !== false,
      invoiceId: params.invoiceId,
      performedBy: params.performedBy,
      remarks: params.remarks,
    });
  }

  if (usages.length) {
    await ResourceUsage.insertMany(usages);
    params.ledger.totalItems = (params.ledger.totalItems || 0) + qty;
    params.ledger.totalAmount = (params.ledger.totalAmount || 0) + amount;
    await params.ledger.save();
  }

  return { usages, amount, qty };
};

/** Scan patient QR + item barcode → FEFO consume → bill → ledger */
export const scanConsume = async (params: {
  hospitalId: any;
  wristband?: string;
  patientId?: string;
  admissionId?: string;
  barcode?: string;
  itemId?: string;
  storeId: string;
  quantity: number;
  billPatient?: boolean;
  performedBy?: string;
  remarks?: string;
}) => {
  let patientId = params.patientId;
  let admissionId = params.admissionId;

  if (params.wristband) {
    const resolved = await resolveWristband(params.hospitalId, params.wristband);
    patientId = String((resolved.patient as any)._id || resolved.patient);
    admissionId = String(resolved.admission._id);
  }

  if (!patientId) throw new AppError('Patient wristband or patientId is required', 400);

  let itemId = params.itemId;
  let barcode = params.barcode;
  if (params.barcode) {
    const resolved = await resolveBarcode(params.hospitalId, params.barcode);
    itemId = String(resolved.item._id);
    barcode = resolved.barcode;
  }
  if (!itemId) throw new AppError('Item barcode or itemId is required', 400);

  const ledger = await getOrCreateOpenLedger({
    hospitalId: params.hospitalId,
    patientId,
    admissionId,
  });

  const result = await consumeFefo({
    hospitalId: params.hospitalId,
    itemId,
    storeId: params.storeId,
    quantity: params.quantity,
    patientId,
    admissionId: admissionId || String(ledger.admissionId),
    performedBy: params.performedBy,
    billPatient: params.billPatient !== false,
    referenceType: 'PATIENT_SCAN',
    remarks: params.remarks || (barcode ? `Scan ${barcode}` : 'Mobile scan'),
  });

  const usage = await recordUsages({
    hospitalId: params.hospitalId,
    ledger,
    patientId,
    admissionId: admissionId || ledger.admissionId,
    source: 'SCAN',
    deductions: result.deductions,
    item: result.item,
    storeId: params.storeId,
    invoiceId: result.invoice?._id,
    performedBy: params.performedBy,
    remarks: params.remarks,
    billed: params.billPatient !== false,
  });

  return {
    patientId,
    admissionId: admissionId || ledger.admissionId,
    item: result.item,
    deductions: result.deductions,
    invoice: result.invoice,
    ledger,
    usage,
  };
};

/** Apply a procedure template — consume all kit items and bill */
export const applyProcedureTemplate = async (params: {
  hospitalId: any;
  templateId: string;
  storeId: string;
  wristband?: string;
  patientId?: string;
  admissionId?: string;
  billPatient?: boolean;
  performedBy?: string;
  skipOptional?: boolean;
}) => {
  const template = await ProcedureTemplate.findOne({
    _id: params.templateId,
    hospitalId: params.hospitalId,
    isActive: true,
  }).populate('items.itemId', 'name barcode sellingPrice gstRate');

  if (!template) throw new AppError('Procedure template not found', 404);

  let patientId = params.patientId;
  let admissionId = params.admissionId;

  if (params.wristband) {
    const resolved = await resolveWristband(params.hospitalId, params.wristband);
    patientId = String((resolved.patient as any)._id || resolved.patient);
    admissionId = String(resolved.admission._id);
  }
  if (!patientId) throw new AppError('Patient wristband or patientId is required', 400);

  const ledger = await getOrCreateOpenLedger({
    hospitalId: params.hospitalId,
    patientId,
    admissionId,
  });

  const results: any[] = [];
  const errors: string[] = [];

  for (const line of template.items) {
    if (params.skipOptional && line.isOptional) continue;
    const itemRef: any = line.itemId;
    const itemId = String(itemRef._id || itemRef);

    try {
      const result = await consumeFefo({
        hospitalId: params.hospitalId,
        itemId,
        storeId: params.storeId,
        quantity: line.quantity,
        patientId,
        admissionId: admissionId || String(ledger.admissionId),
        performedBy: params.performedBy,
        billPatient: params.billPatient !== false,
        referenceType: 'PROCEDURE_TEMPLATE',
        referenceId: String(template._id),
        remarks: `Template: ${template.name}`,
      });

      await recordUsages({
        hospitalId: params.hospitalId,
        ledger,
        patientId,
        admissionId: admissionId || ledger.admissionId,
        source: 'TEMPLATE',
        deductions: result.deductions,
        item: result.item,
        storeId: params.storeId,
        templateId: String(template._id),
        templateName: template.name,
        invoiceId: result.invoice?._id,
        performedBy: params.performedBy,
        billed: params.billPatient !== false,
      });

      results.push({
        itemId,
        itemName: result.item.name,
        quantity: line.quantity,
        deductions: result.deductions,
        invoice: result.invoice,
      });
    } catch (err: any) {
      errors.push(`${itemRef.name || itemId}: ${err.message || 'failed'}`);
    }
  }

  if (!results.length && errors.length) {
    throw new AppError(`Template apply failed: ${errors.join('; ')}`, 400);
  }

  const refreshed = await PatientResourceLedger.findById(ledger._id);

  return {
    template: { _id: template._id, code: template.code, name: template.name },
    patientId,
    admissionId: admissionId || ledger.admissionId,
    results,
    errors,
    ledger: refreshed,
  };
};

export const ensureDefaultBedRates = async (hospitalId: any) => {
  const count = await BedChargeRate.countDocuments({ hospitalId });
  if (count > 0) return BedChargeRate.find({ hospitalId, isActive: true });

  await BedChargeRate.insertMany(
    DEFAULT_BED_RATES.map((r) => ({ ...r, hospitalId, isActive: true }))
  );
  return BedChargeRate.find({ hospitalId, isActive: true });
};

export const getBedChargeForWard = async (hospitalId: any, wardCategory: string) => {
  await ensureDefaultBedRates(hospitalId);
  const rate = await BedChargeRate.findOne({
    hospitalId,
    wardCategory,
    isActive: true,
  });

  if (rate) {
    return {
      category: rate.billCategory,
      dailyRate: rate.dailyRate,
      admissionFee: rate.admissionFee,
    };
  }

  if (wardCategory === 'ICU') {
    return { category: 'ICU Bed' as const, dailyRate: 5000, admissionFee: 1500 };
  }
  return { category: 'IPD Ward' as const, dailyRate: 2500, admissionFee: 800 };
};

/** Seed procedure templates by matching catalog item names (best-effort) */
export const ensureDefaultTemplates = async (hospitalId: any, userId?: string) => {
  const existing = await ProcedureTemplate.countDocuments({ hospitalId });
  if (existing > 0) {
    return ProcedureTemplate.find({ hospitalId, isActive: true })
      .populate('items.itemId', 'name itemCode barcode unit sellingPrice')
      .sort({ name: 1 });
  }

  const catalog = await CatalogItem.find({ hospitalId, isActive: true });
  const findItem = (hint: string) =>
    catalog.find((c) => c.name.toLowerCase().includes(hint.toLowerCase()));

  const created = [];
  for (const tpl of DEFAULT_PROCEDURE_TEMPLATES) {
    const items = tpl.items
      .map((line) => {
        const match = findItem(line.nameHint);
        if (!match) return null;
        return { itemId: match._id, quantity: line.quantity, isOptional: false };
      })
      .filter(Boolean) as { itemId: any; quantity: number; isOptional: boolean }[];

    if (!items.length) continue;

    created.push({
      hospitalId,
      code: tpl.code,
      name: tpl.name,
      description: tpl.description,
      category: tpl.category,
      items,
      isActive: true,
      createdBy: userId,
    });
  }

  if (created.length) await ProcedureTemplate.insertMany(created);

  return ProcedureTemplate.find({ hospitalId, isActive: true })
    .populate('items.itemId', 'name itemCode barcode unit sellingPrice')
    .sort({ name: 1 });
};

/**
 * Compare ward/patient stock consumption vs billed resource usages.
 * Flags inventory deducted for a patient but not billed.
 */
export const runReconciliation = async (hospitalId: any, days = 7) => {
  const since = new Date(Date.now() - days * 86400000);
  const hid = oid(hospitalId);

  const unbilled = await ResourceUsage.find({
    hospitalId: hid,
    billed: false,
    createdAt: { $gte: since },
  })
    .populate('patientId', 'name patientId')
    .populate('itemId', 'name itemCode')
    .limit(200);

  const stockTxns = await StockTransaction.find({
    hospitalId: hid,
    transactionType: 'CONSUMPTION',
    patientId: { $ne: null },
    createdAt: { $gte: since },
  }).select('patientId itemId quantity unitCost createdAt');

  const billedUsages = await ResourceUsage.find({
    hospitalId: hid,
    billed: true,
    source: { $in: ['SCAN', 'TEMPLATE', 'PHARMACY', 'MANUAL'] },
    createdAt: { $gte: since },
  }).select('patientId itemId quantity');

  type Key = string;
  const keyOf = (pid: any, iid: any) => `${pid}:${iid}`;

  const consumedMap = new Map<Key, number>();
  for (const t of stockTxns) {
    const k = keyOf(t.patientId, t.itemId);
    consumedMap.set(k, (consumedMap.get(k) || 0) + t.quantity);
  }

  const billedMap = new Map<Key, number>();
  for (const u of billedUsages) {
    if (!u.itemId) continue;
    const k = keyOf(u.patientId, u.itemId);
    billedMap.set(k, (billedMap.get(k) || 0) + u.quantity);
  }

  const mismatchKeys = new Set<Key>();
  for (const [k, qty] of consumedMap) {
    const billed = billedMap.get(k) || 0;
    if (qty > billed) mismatchKeys.add(k);
  }

  // Clear prior open auto-alerts in window and recreate
  await ReconciliationAlert.deleteMany({
    hospitalId: hid,
    status: 'Open',
    type: { $in: ['UNBILLED_CONSUMPTION', 'QTY_MISMATCH'] },
    createdAt: { $gte: since },
  });

  const alerts: any[] = [];

  for (const usage of unbilled) {
    const alert = await ReconciliationAlert.create({
      hospitalId: hid,
      type: 'UNBILLED_CONSUMPTION',
      severity: 'High',
      patientId: usage.patientId,
      admissionId: usage.admissionId,
      itemId: usage.itemId,
      itemName: usage.itemName,
      consumedQty: usage.quantity,
      billedQty: 0,
      amount: usage.totalPrice,
      message: `Unbilled ${usage.quantity}× ${usage.itemName} for patient`,
      status: 'Open',
    });
    alerts.push(alert);
  }

  for (const k of mismatchKeys) {
    const [patientId, itemId] = k.split(':');
    const consumedQty = consumedMap.get(k) || 0;
    const billedQty = billedMap.get(k) || 0;
    if (consumedQty <= billedQty) continue;

    // Skip if already covered by explicit unbilled usage alert for same pair
    const item = await CatalogItem.findById(itemId).select('name');
    const alert = await ReconciliationAlert.create({
      hospitalId: hid,
      type: 'QTY_MISMATCH',
      severity: consumedQty - billedQty >= 5 ? 'High' : 'Medium',
      patientId,
      itemId,
      itemName: item?.name,
      consumedQty,
      billedQty,
      amount: 0,
      message: `Stock consumed ${consumedQty} but billed ${billedQty} for ${item?.name || 'item'}`,
      status: 'Open',
    });
    alerts.push(alert);
  }

  const openAlerts = await ReconciliationAlert.find({ hospitalId: hid, status: 'Open' })
    .populate('patientId', 'name patientId')
    .populate('itemId', 'name itemCode')
    .sort({ createdAt: -1 })
    .limit(100);

  return {
    windowDays: days,
    unbilledCount: unbilled.length,
    mismatchCount: mismatchKeys.size,
    alertsCreated: alerts.length,
    alerts: openAlerts,
  };
};

export const getPatientLedgerDetail = async (hospitalId: any, admissionId: string) => {
  const ledger = await PatientResourceLedger.findOne({ hospitalId, admissionId })
    .populate('patientId', 'name patientId contact.phone')
    .populate('admissionId');

  if (!ledger) throw new AppError('Resource ledger not found', 404);

  const usages = await ResourceUsage.find({ ledgerId: ledger._id })
    .populate('itemId', 'name itemCode barcode unit')
    .populate('storeId', 'name type')
    .populate('performedBy', 'name')
    .sort({ createdAt: -1 });

  const bySource = usages.reduce((acc: Record<string, number>, u) => {
    acc[u.source] = (acc[u.source] || 0) + u.totalPrice;
    return acc;
  }, {});

  return { ledger, usages, bySource };
};

export const getDefaultStoreId = async (hospitalId: any) => {
  const stores = await ensureDefaultStores(hospitalId);
  const ward = stores.find(
    (s: any) => s.type === 'General Ward' || /ward/i.test(s.name) || s.type === 'ICU'
  );
  const pharmacy = stores.find((s: any) => s.type === 'Pharmacy');
  return String((ward || pharmacy || stores[0])?._id);
};
