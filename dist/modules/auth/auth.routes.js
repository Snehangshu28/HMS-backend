"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const auth_controller_1 = require("./auth.controller");
const auth_1 = require("../../middleware/auth");
const user_model_1 = require("./user.model");
const common_1 = require("../../common");
const router = (0, express_1.Router)();
router.post('/signup', auth_controller_1.signup);
router.post('/login', auth_controller_1.login);
router.post('/refresh', auth_controller_1.refresh);
router.get('/me', auth_1.protect, (0, common_1.asyncHandler)(async (req, res) => {
    const user = await user_model_1.User.findById(req.user?.id).populate('hospitalId');
    return (0, common_1.sendResponse)(res, 200, 'User profile fetched successfully', user);
}));
exports.default = router;
