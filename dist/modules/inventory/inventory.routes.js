"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const inventory_controller_1 = require("./inventory.controller");
const auth_1 = require("../../middleware/auth");
const router = (0, express_1.Router)();
router.use(auth_1.protect);
router.route('/')
    .post((0, auth_1.authorize)('Hospital Admin'), inventory_controller_1.addInventoryItem)
    .get(inventory_controller_1.getInventoryItems);
router.route('/vendors')
    .post((0, auth_1.authorize)('Hospital Admin'), inventory_controller_1.addVendor)
    .get((0, auth_1.authorize)('Hospital Admin'), inventory_controller_1.getVendors);
exports.default = router;
