import { Server as SocketIOServer, Socket } from 'socket.io';
import http from 'http';
import jwt from 'jsonwebtoken';
import { config } from '../config';
import { IUserPayload } from '../types';

let io: SocketIOServer | null = null;

export const initSockets = (server: http.Server): SocketIOServer => {
  io = new SocketIOServer(server, {
    cors: {
      origin: '*',
      methods: ['GET', 'POST']
    }
  });

  // Socket JWT authentication middleware
  io.use((socket: Socket, next) => {
    const token = socket.handshake.auth?.token || socket.handshake.query?.token;

    if (!token) {
      return next(new Error('Authentication error: Token missing'));
    }

    try {
      const decoded = jwt.verify(token, config.jwtSecret) as IUserPayload;
      socket.data.user = decoded;
      next();
    } catch (err) {
      return next(new Error('Authentication error: Invalid token'));
    }
  });

  io.on('connection', (socket: Socket) => {
    const user = socket.data.user as IUserPayload;
    
    // Join tenant isolation room
    socket.join(`hospital:${user.hospitalId}`);

    // Join role channel room
    socket.join(`hospital:${user.hospitalId}:role:${user.role}`);

    socket.on('disconnect', () => {
      // Automatic cleanup handled by socket.io
    });
  });

  return io;
};

// Queue changes broadcasts
export const broadcastQueueUpdate = (hospitalId: string, doctorId: string, queue: any) => {
  if (io) {
    io.to(`hospital:${hospitalId}`).emit('queue:update', { doctorId, queue });
  }
};

// Emergency alerts broadcast (targeted to doctors and nurses)
export const broadcastEmergency = (hospitalId: string, alert: any) => {
  if (io) {
    io.to(`hospital:${hospitalId}:role:Doctor`).emit('emergency:alert', alert);
    io.to(`hospital:${hospitalId}:role:Nurse`).emit('emergency:alert', alert);
  }
};

// Target broadcasts to specific staff channels
export const broadcastToRole = (hospitalId: string, role: string, event: string, data: any) => {
  if (io) {
    io.to(`hospital:${hospitalId}:role:${role}`).emit(event, data);
  }
};
