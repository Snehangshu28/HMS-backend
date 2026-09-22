export interface IUserPayload {
  id: string;
  email: string;
  role: string;
  hospitalId: string;
}

declare global {
  namespace Express {
    interface Request {
      user?: IUserPayload;
      hospitalId?: string;
    }
  }
}
