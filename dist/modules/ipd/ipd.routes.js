"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const ipd_controller_1 = require("./ipd.controller");
const auth_1 = require("../../middleware/auth");
const router = (0, express_1.Router)();
router.use(auth_1.protect);
router.post('/wards', (0, auth_1.authorize)('Hospital Admin'), ipd_controller_1.createWard);
router.post('/beds', (0, auth_1.authorize)('Hospital Admin'), ipd_controller_1.createBed);
router.get('/layout', ipd_controller_1.getWardsAndBeds);
router.route('/admissions')
    .post((0, auth_1.authorize)('Doctor', 'Receptionist', 'Hospital Admin'), ipd_controller_1.admitPatient)
    .get(ipd_controller_1.getAdmissions);
router.post('/admissions/:id/discharge', (0, auth_1.authorize)('Doctor', 'Nurse'), ipd_controller_1.dischargePatient);
exports.default = router;
