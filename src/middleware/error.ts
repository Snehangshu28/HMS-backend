import { Request, Response, NextFunction } from 'express';
import { AppError } from '../common';
import { config } from '../config';

export const errorHandler = (
  err: any,
  req: Request,
  res: Response,
  next: NextFunction
) => {
  const statusCode = err.statusCode || 500;
  const message = err.message || 'Internal Server Error';

  res.status(statusCode).json({
    success: false,
    message,
    stack: config.nodeEnv === 'development' ? err.stack : undefined
  });
};
