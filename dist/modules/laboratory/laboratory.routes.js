"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const laboratory_controller_1 = require("./laboratory.controller");
const auth_1 = require("../../middleware/auth");
const router = (0, express_1.Router)();
router.use(auth_1.protect);
router.route('/tests')
    .post((0, auth_1.authorize)('Doctor'), laboratory_controller_1.orderLabTest)
    .get(laboratory_controller_1.getLabTests);
router.post('/samples', (0, auth_1.authorize)('Lab Technician', 'Nurse'), laboratory_controller_1.collectSample);
router.post('/reports', (0, auth_1.authorize)('Lab Technician'), laboratory_controller_1.uploadLabReport);
router.get('/reports/:labTestId', laboratory_controller_1.getLabReport);
exports.default = router;
