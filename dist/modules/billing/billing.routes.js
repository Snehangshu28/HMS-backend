"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const billing_controller_1 = require("./billing.controller");
const auth_1 = require("../../middleware/auth");
const router = (0, express_1.Router)();
router.use(auth_1.protect);
router.route('/invoices')
    .post((0, auth_1.authorize)('Accountant'), billing_controller_1.createInvoice)
    .get((0, auth_1.authorize)('Accountant', 'Hospital Admin'), billing_controller_1.getInvoices);
router.post('/payments', (0, auth_1.authorize)('Accountant'), billing_controller_1.recordPayment);
router.post('/claims', (0, auth_1.authorize)('Accountant'), billing_controller_1.fileInsuranceClaim);
exports.default = router;
