import express from 'express';
import http from 'http';
import cors from 'cors';
import helmet from 'helmet';
import mongoSanitize from 'express-mongo-sanitize';
import { connectDB } from './database';
import { initSockets } from './sockets';
import { errorHandler } from './middleware/error';
import { config } from './config';

// Import Routes
import authRoutes from './modules/auth/auth.routes';
import patientRoutes from './modules/patients/patients.routes';
import doctorRoutes from './modules/doctors/doctors.routes';
import appointmentRoutes from './modules/appointments/appointments.routes';
import emrRoutes from './modules/emr/emr.routes';
import billingRoutes from './modules/billing/billing.routes';
import labRoutes from './modules/laboratory/laboratory.routes';
import pharmacyRoutes from './modules/pharmacy/pharmacy.routes';
import ipdRoutes from './modules/ipd/ipd.routes';
import inventoryRoutes from './modules/inventory/inventory.routes';
import resourceRoutes from './modules/resources/resources.routes';
import notificationRoutes from './modules/notifications/notifications.routes';
import analyticsRoutes from './modules/analytics/analytics.routes';
import aiRoutes from './modules/ai/ai.routes';

const app = express();
const server = http.createServer(app);

// Initialize Sockets
initSockets(server);

// Connect to MongoDB
connectDB();

// Global Middlewares
app.use(helmet());
app.use(cors({ origin: '*' }));
app.use(express.json({ limit: '15mb' }));
app.use(express.urlencoded({ extended: true, limit: '15mb' }));
app.use(mongoSanitize());

// API Routes Mounting
app.use('/api/v1/auth', authRoutes);
app.use('/api/v1/patients', patientRoutes);
app.use('/api/v1/doctors', doctorRoutes);
app.use('/api/v1/appointments', appointmentRoutes);
app.use('/api/v1/emr', emrRoutes);
app.use('/api/v1/billing', billingRoutes);
app.use('/api/v1/laboratory', labRoutes);
app.use('/api/v1/pharmacy', pharmacyRoutes);
app.use('/api/v1/ipd', ipdRoutes);
app.use('/api/v1/inventory', inventoryRoutes);
app.use('/api/v1/resources', resourceRoutes);
app.use('/api/v1/notifications', notificationRoutes);
app.use('/api/v1/analytics', analyticsRoutes);
app.use('/api/v1/ai', aiRoutes);

// Base Health Check
app.get('/health', (req, res) => {
  res.status(200).json({ status: 'OK', environment: config.nodeEnv });
});

// Global Error Handler
app.use(errorHandler);

// Start Server
const PORT = config.port;
server.listen(PORT, () => {
  console.log(`Hospital Operating System Server running on port ${PORT} in ${config.nodeEnv} mode`);
});

export default app;
