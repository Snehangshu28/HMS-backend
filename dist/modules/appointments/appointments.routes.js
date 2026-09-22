"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const appointments_controller_1 = require("./appointments.controller");
const auth_1 = require("../../middleware/auth");
const router = (0, express_1.Router)();
router.use(auth_1.protect);
router.route('/')
    .post((0, auth_1.authorize)('Receptionist', 'Patient', 'Hospital Admin'), appointments_controller_1.createAppointment)
    .get(appointments_controller_1.getAppointments);
router.route('/:id')
    .put((0, auth_1.authorize)('Receptionist', 'Doctor', 'Nurse', 'Hospital Admin'), appointments_controller_1.updateAppointmentStatus);
router.get('/queue/active', appointments_controller_1.getActiveQueue);
router.put('/queue/:id', (0, auth_1.authorize)('Receptionist', 'Doctor', 'Nurse', 'Hospital Admin'), appointments_controller_1.updateQueueStatus);
exports.default = router;
