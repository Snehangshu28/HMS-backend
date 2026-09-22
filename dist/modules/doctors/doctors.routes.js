"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const doctors_controller_1 = require("./doctors.controller");
const auth_1 = require("../../middleware/auth");
const router = (0, express_1.Router)();
router.use(auth_1.protect);
router.route('/')
    .post((0, auth_1.authorize)('Hospital Admin'), doctors_controller_1.createDoctorProfile)
    .get(doctors_controller_1.getDoctors);
router.route('/:id')
    .get(doctors_controller_1.getDoctorProfile)
    .put((0, auth_1.authorize)('Hospital Admin', 'Doctor'), doctors_controller_1.updateDoctorProfile);
router.put('/:id/schedule', (0, auth_1.authorize)('Hospital Admin', 'Doctor'), doctors_controller_1.updateDoctorSchedule);
exports.default = router;
