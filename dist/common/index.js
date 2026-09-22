"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.sendResponse = exports.asyncHandler = exports.AppError = void 0;
// Custom Application Error
class AppError extends Error {
    statusCode;
    isOperational;
    constructor(message, statusCode) {
        super(message);
        this.statusCode = statusCode;
        this.isOperational = true;
        Error.captureStackTrace(this, this.constructor);
    }
}
exports.AppError = AppError;
// Express Async Handler Wrapper
const asyncHandler = (fn) => {
    return (req, res, next) => {
        fn(req, res, next).catch(next);
    };
};
exports.asyncHandler = asyncHandler;
// Standard Success Response Utility
const sendResponse = (res, statusCode, message, data = null) => {
    return res.status(statusCode).json({
        success: true,
        message,
        data
    });
};
exports.sendResponse = sendResponse;
