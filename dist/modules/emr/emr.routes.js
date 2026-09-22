"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const emr_controller_1 = require("./emr.controller");
const auth_1 = require("../../middleware/auth");
const router = (0, express_1.Router)();
router.use(auth_1.protect);
router.post('/records', (0, auth_1.authorize)('Doctor'), emr_controller_1.createMedicalRecord);
router.get('/records/:patientId', emr_controller_1.getPatientMedicalHistory);
router.route('/prescriptions')
    .post((0, auth_1.authorize)('Doctor'), emr_controller_1.createPrescription)
    .get(emr_controller_1.getPrescriptions);
exports.default = router;
