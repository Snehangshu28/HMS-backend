"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.authorize = exports.protect = void 0;
const jsonwebtoken_1 = __importDefault(require("jsonwebtoken"));
const common_1 = require("../common");
const config_1 = require("../config");
exports.protect = (0, common_1.asyncHandler)(async (req, res, next) => {
    let token;
    if (req.headers.authorization && req.headers.authorization.startsWith('Bearer')) {
        token = req.headers.authorization.split(' ')[1];
    }
    if (!token) {
        throw new common_1.AppError('Not authorized to access this route', 401);
    }
    try {
        const decoded = jsonwebtoken_1.default.verify(token, config_1.config.jwtSecret);
        req.user = decoded;
        req.hospitalId = decoded.hospitalId;
        next();
    }
    catch (err) {
        throw new common_1.AppError('Not authorized to access this route', 401);
    }
});
const authorize = (...roles) => {
    return (req, res, next) => {
        if (!req.user) {
            return next(new common_1.AppError('Not authorized to access this route', 401));
        }
        if (!roles.includes(req.user.role)) {
            return next(new common_1.AppError(`User role '${req.user.role}' is not authorized to access this route`, 403));
        }
        next();
    };
};
exports.authorize = authorize;
