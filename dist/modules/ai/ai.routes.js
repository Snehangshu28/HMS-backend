"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const ai_service_1 = require("../../services/ai.service");
const auth_1 = require("../../middleware/auth");
const common_1 = require("../../common");
const router = (0, express_1.Router)();
router.use(auth_1.protect);
router.use((0, auth_1.authorize)('Doctor'));
router.post('/soap-summary', (0, common_1.asyncHandler)(async (req, res) => {
    const { transcript } = req.body;
    const soapNotes = await ai_service_1.AIService.generateSOAPNotes(transcript);
    return (0, common_1.sendResponse)(res, 200, 'SOAP notes formatted by AI', soapNotes);
}));
router.post('/suggest-diagnosis', (0, common_1.asyncHandler)(async (req, res) => {
    const { symptoms } = req.body;
    const suggestions = await ai_service_1.AIService.suggestDiagnoses(symptoms || []);
    return (0, common_1.sendResponse)(res, 200, 'Diagnosis suggested by AI', suggestions);
}));
router.post('/parse-prescription', (0, common_1.asyncHandler)(async (req, res) => {
    const { note } = req.body;
    const medicines = await ai_service_1.AIService.parsePrescriptionNote(note);
    return (0, common_1.sendResponse)(res, 200, 'Prescription parsed by AI', medicines);
}));
exports.default = router;
