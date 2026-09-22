"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.errorHandler = void 0;
const config_1 = require("../config");
const errorHandler = (err, req, res, next) => {
    const statusCode = err.statusCode || 500;
    const message = err.message || 'Internal Server Error';
    res.status(statusCode).json({
        success: false,
        message,
        stack: config_1.config.nodeEnv === 'development' ? err.stack : undefined
    });
};
exports.errorHandler = errorHandler;
