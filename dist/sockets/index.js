"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.broadcastToRole = exports.broadcastEmergency = exports.broadcastQueueUpdate = exports.initSockets = void 0;
const socket_io_1 = require("socket.io");
const jsonwebtoken_1 = __importDefault(require("jsonwebtoken"));
const config_1 = require("../config");
let io = null;
const initSockets = (server) => {
    io = new socket_io_1.Server(server, {
        cors: {
            origin: '*',
            methods: ['GET', 'POST']
        }
    });
    // Socket JWT authentication middleware
    io.use((socket, next) => {
        const token = socket.handshake.auth?.token || socket.handshake.query?.token;
        if (!token) {
            return next(new Error('Authentication error: Token missing'));
        }
        try {
            const decoded = jsonwebtoken_1.default.verify(token, config_1.config.jwtSecret);
            socket.data.user = decoded;
            next();
        }
        catch (err) {
            return next(new Error('Authentication error: Invalid token'));
        }
    });
    io.on('connection', (socket) => {
        const user = socket.data.user;
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
exports.initSockets = initSockets;
// Queue changes broadcasts
const broadcastQueueUpdate = (hospitalId, doctorId, queue) => {
    if (io) {
        io.to(`hospital:${hospitalId}`).emit('queue:update', { doctorId, queue });
    }
};
exports.broadcastQueueUpdate = broadcastQueueUpdate;
// Emergency alerts broadcast (targeted to doctors and nurses)
const broadcastEmergency = (hospitalId, alert) => {
    if (io) {
        io.to(`hospital:${hospitalId}:role:Doctor`).emit('emergency:alert', alert);
        io.to(`hospital:${hospitalId}:role:Nurse`).emit('emergency:alert', alert);
    }
};
exports.broadcastEmergency = broadcastEmergency;
// Target broadcasts to specific staff channels
const broadcastToRole = (hospitalId, role, event, data) => {
    if (io) {
        io.to(`hospital:${hospitalId}:role:${role}`).emit(event, data);
    }
};
exports.broadcastToRole = broadcastToRole;
