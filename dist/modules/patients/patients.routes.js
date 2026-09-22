"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const patients_controller_1 = require("./patients.controller");
const auth_1 = require("../../middleware/auth");
const router = (0, express_1.Router)();
router.use(auth_1.protect);
router.route('/')
    .post((0, auth_1.authorize)('Receptionist', 'Doctor', 'Nurse', 'Hospital Admin'), patients_controller_1.createPatient)
    .get(patients_controller_1.getPatients);
router.route('/:id')
    .get(patients_controller_1.getPatientById)
    .put((0, auth_1.authorize)('Receptionist', 'Doctor', 'Nurse', 'Hospital Admin'), patients_controller_1.updatePatient);
router.post('/:id/vitals', (0, auth_1.authorize)('Nurse', 'Doctor'), patients_controller_1.recordVitals);
router.put('/:id/history', (0, auth_1.authorize)('Doctor', 'Nurse'), patients_controller_1.updateHistory);
exports.default = router;
