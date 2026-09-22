import { Request, Response, NextFunction } from 'express';

// Custom Application Error
export class AppError extends Error {
  public readonly statusCode: number;
  public readonly isOperational: boolean;

  constructor(message: string, statusCode: number) {
    super(message);
    this.statusCode = statusCode;
    this.isOperational = true;

    Error.captureStackTrace(this, this.constructor);
  }
}

// Express Async Handler Wrapper
export const asyncHandler = (fn: Function) => {
  return (req: Request, res: Response, next: NextFunction) => {
    fn(req, res, next).catch(next);
  };
};

// Standard Success Response Utility
export const sendResponse = (res: Response, statusCode: number, message: string, data: any = null) => {
  return res.status(statusCode).json({
    success: true,
    message,
    data
  });
};
