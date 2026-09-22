"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const pharmacy_controller_1 = require("./pharmacy.controller");
const auth_1 = require("../../middleware/auth");
const router = (0, express_1.Router)();
router.use(auth_1.protect);
router.route('/inventory')
    .post((0, auth_1.authorize)('Pharmacist', 'Hospital Admin'), pharmacy_controller_1.addMedicine)
    .get(pharmacy_controller_1.getMedicines);
router.route('/sales')
    .post((0, auth_1.authorize)('Pharmacist'), pharmacy_controller_1.sellMedicines)
    .get((0, auth_1.authorize)('Pharmacist', 'Accountant', 'Hospital Admin'), pharmacy_controller_1.getSalesLog);
exports.default = router;
