"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getLabReport = exports.getLabTests = exports.uploadLabReport = exports.collectSample = exports.orderLabTest = void 0;
const models_1 = require("./models");
const common_1 = require("../../common");
// @desc    Order a Lab Test
// @route   POST /api/v1/laboratory/tests
// @access  Private (Doctor)
exports.orderLabTest = (0, common_1.asyncHandler)(async (req, res) => {
    const { patientId, testName, code, fee, orderedBy } = req.body;
    if (!patientId || !testName || !code || !fee) {
        throw new common_1.AppError('Patient ID, test name, code, and fee are required', 400);
    }
    const labTest = await models_1.LabTest.create({
        hospitalId: req.hospitalId,
        patientId,
        testName,
        code,
        fee,
        orderedBy
    });
    return (0, common_1.sendResponse)(res, 201, 'Lab test ordered successfully', labTest);
});
// @desc    Log Sample Collection & generate barcode
// @route   POST /api/v1/laboratory/samples
// @access  Private (Lab Technician, Nurse)
exports.collectSample = (0, common_1.asyncHandler)(async (req, res) => {
    const { labTestId, sampleType } = req.body;
    if (!labTestId || !sampleType) {
        throw new common_1.AppError('Lab test ID and sample type are required', 400);
    }
    const labTest = await models_1.LabTest.findOne({ _id: labTestId, hospitalId: req.hospitalId });
    if (!labTest) {
        throw new common_1.AppError('Lab test not found', 404);
    }
    // Generate unique clinical barcode
    const barcode = `SMP-${new Date().toISOString().slice(0, 10).replace(/-/g, '')}-${Math.floor(1000 + Math.random() * 9000)}`;
    const sample = await models_1.Sample.create({
        hospitalId: req.hospitalId,
        labTestId,
        barcode,
        sampleType,
        collectedBy: req.user?.id
    });
    labTest.status = 'Sample Collected';
    await labTest.save();
    return (0, common_1.sendResponse)(res, 201, 'Sample collection logged successfully', { sample, labTest });
});
// @desc    Upload test parameters and generate PDF report link
// @route   POST /api/v1/laboratory/reports
// @access  Private (Lab Technician)
exports.uploadLabReport = (0, common_1.asyncHandler)(async (req, res) => {
    const { labTestId, patientId, parameters, reportFileUrl } = req.body;
    if (!labTestId || !patientId || !parameters || !parameters.length) {
        throw new common_1.AppError('Lab test ID, patient ID, and report parameters are required', 400);
    }
    const labTest = await models_1.LabTest.findOne({ _id: labTestId, hospitalId: req.hospitalId });
    if (!labTest) {
        throw new common_1.AppError('Lab test not found', 404);
    }
    const report = await models_1.LabReport.create({
        hospitalId: req.hospitalId,
        labTestId,
        patientId,
        parameters,
        reportFileUrl,
        uploadedBy: req.user?.id
    });
    labTest.status = 'Completed';
    await labTest.save();
    return (0, common_1.sendResponse)(res, 201, 'Lab report generated and uploaded successfully', report);
});
// @desc    List Lab Tests
// @route   GET /api/v1/laboratory/tests
// @access  Private (All staff)
exports.getLabTests = (0, common_1.asyncHandler)(async (req, res) => {
    const { patientId, status } = req.query;
    const query = { hospitalId: req.hospitalId };
    if (patientId)
        query.patientId = patientId;
    if (status)
        query.status = status;
    const tests = await models_1.LabTest.find(query)
        .populate('patientId', 'name patientId contact.phone')
        .sort({ createdAt: -1 });
    return (0, common_1.sendResponse)(res, 200, 'Lab tests retrieved successfully', tests);
});
// @desc    Retrieve single Lab Report
// @route   GET /api/v1/laboratory/reports/:labTestId
// @access  Private (Doctor, Lab Technician, Patient)
exports.getLabReport = (0, common_1.asyncHandler)(async (req, res) => {
    const { labTestId } = req.params;
    const report = await models_1.LabReport.findOne({ labTestId, hospitalId: req.hospitalId })
        .populate('patientId', 'name patientId dateOfBirth gender')
        .populate({
        path: 'labTestId',
        populate: { path: 'orderedBy', populate: { path: 'userId', select: 'name' } }
    });
    if (!report) {
        throw new common_1.AppError('Lab report not found', 404);
    }
    return (0, common_1.sendResponse)(res, 200, 'Lab report retrieved successfully', report);
});
