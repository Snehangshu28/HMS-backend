import { Request, Response } from 'express';
import { LabTest, Sample, LabReport } from './models';
import { appendChargesToPatientBill } from '../billing/billing.service';
import { AppError, asyncHandler, sendResponse } from '../../common';

export const orderLabTest = asyncHandler(async (req: Request, res: Response) => {
  const { patientId, testName, code, fee, orderedBy } = req.body;

  if (!patientId || !testName || !code || fee === undefined || fee === null) {
    throw new AppError('Patient ID, test name, code, and fee are required', 400);
  }

  const amount = Number(fee) || 0;

  const labTest = await LabTest.create({
    hospitalId: req.hospitalId,
    patientId,
    testName,
    code,
    fee: amount,
    orderedBy,
  });

  let invoice = null;
  if (amount > 0) {
    invoice = await appendChargesToPatientBill(req.hospitalId, patientId, [
      {
        description: `Laboratory — ${testName}`,
        category: 'Lab Test',
        quantity: 1,
        unitPrice: amount,
      },
    ]);
  }

  return sendResponse(res, 201, 'Lab test ordered and billed to patient', { labTest, invoice });
});

export const collectSample = asyncHandler(async (req: Request, res: Response) => {
  const { labTestId, sampleType } = req.body;

  if (!labTestId || !sampleType) {
    throw new AppError('Lab test ID and sample type are required', 400);
  }

  const labTest = await LabTest.findOne({ _id: labTestId, hospitalId: req.hospitalId });
  if (!labTest) {
    throw new AppError('Lab test not found', 404);
  }

  const barcode = `SMP-${new Date().toISOString().slice(0, 10).replace(/-/g, '')}-${Math.floor(
    1000 + Math.random() * 9000
  )}`;

  const sample = await Sample.create({
    hospitalId: req.hospitalId,
    labTestId,
    barcode,
    sampleType,
    collectedBy: req.user?.id,
  });

  labTest.status = 'Sample Collected';
  await labTest.save();

  return sendResponse(res, 201, 'Sample collection logged successfully', { sample, labTest });
});

export const uploadLabReport = asyncHandler(async (req: Request, res: Response) => {
  const { labTestId, patientId, parameters, reportFileUrl } = req.body;

  if (!labTestId || !patientId || !parameters || !parameters.length) {
    throw new AppError('Lab test ID, patient ID, and report parameters are required', 400);
  }

  const labTest = await LabTest.findOne({ _id: labTestId, hospitalId: req.hospitalId });
  if (!labTest) {
    throw new AppError('Lab test not found', 404);
  }

  const report = await LabReport.create({
    hospitalId: req.hospitalId,
    labTestId,
    patientId,
    parameters,
    reportFileUrl,
    uploadedBy: req.user?.id,
  });

  labTest.status = 'Completed';
  await labTest.save();

  return sendResponse(res, 201, 'Lab report generated and uploaded successfully', report);
});

export const getLabTests = asyncHandler(async (req: Request, res: Response) => {
  const { patientId, status } = req.query;

  const query: any = { hospitalId: req.hospitalId };
  if (patientId) query.patientId = patientId;
  if (status) query.status = status;

  const tests = await LabTest.find(query)
    .populate('patientId', 'name patientId contact.phone')
    .sort({ createdAt: -1 });

  return sendResponse(res, 200, 'Lab tests retrieved successfully', tests);
});

export const getLabReport = asyncHandler(async (req: Request, res: Response) => {
  const { labTestId } = req.params;

  const report = await LabReport.findOne({ labTestId, hospitalId: req.hospitalId })
    .populate('patientId', 'name patientId dateOfBirth gender')
    .populate({
      path: 'labTestId',
      populate: { path: 'orderedBy', populate: { path: 'userId', select: 'name' } },
    });

  if (!report) {
    throw new AppError('Lab report not found', 404);
  }

  return sendResponse(res, 200, 'Lab report retrieved successfully', report);
});
