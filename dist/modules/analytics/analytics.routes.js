"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const analytics_controller_1 = require("./analytics.controller");
const auth_1 = require("../../middleware/auth");
const router = (0, express_1.Router)();
router.use(auth_1.protect);
router.get('/dashboard', (0, auth_1.authorize)('Hospital Admin', 'Super Admin'), analytics_controller_1.getDashboardStats);
exports.default = router;
