"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const http_1 = __importDefault(require("http"));
const cors_1 = __importDefault(require("cors"));
const helmet_1 = __importDefault(require("helmet"));
const express_mongo_sanitize_1 = __importDefault(require("express-mongo-sanitize"));
const database_1 = require("./database");
const sockets_1 = require("./sockets");
const error_1 = require("./middleware/error");
const config_1 = require("./config");
// Import Routes
const auth_routes_1 = __importDefault(require("./modules/auth/auth.routes"));
const patients_routes_1 = __importDefault(require("./modules/patients/patients.routes"));
const doctors_routes_1 = __importDefault(require("./modules/doctors/doctors.routes"));
const appointments_routes_1 = __importDefault(require("./modules/appointments/appointments.routes"));
const emr_routes_1 = __importDefault(require("./modules/emr/emr.routes"));
const billing_routes_1 = __importDefault(require("./modules/billing/billing.routes"));
const laboratory_routes_1 = __importDefault(require("./modules/laboratory/laboratory.routes"));
const pharmacy_routes_1 = __importDefault(require("./modules/pharmacy/pharmacy.routes"));
const ipd_routes_1 = __importDefault(require("./modules/ipd/ipd.routes"));
const inventory_routes_1 = __importDefault(require("./modules/inventory/inventory.routes"));
const notifications_routes_1 = __importDefault(require("./modules/notifications/notifications.routes"));
const analytics_routes_1 = __importDefault(require("./modules/analytics/analytics.routes"));
const ai_routes_1 = __importDefault(require("./modules/ai/ai.routes"));
const app = (0, express_1.default)();
const server = http_1.default.createServer(app);
// Initialize Sockets
(0, sockets_1.initSockets)(server);
// Connect to MongoDB
(0, database_1.connectDB)();
// Global Middlewares
app.use((0, helmet_1.default)());
app.use((0, cors_1.default)({ origin: '*' }));
app.use(express_1.default.json());
app.use(express_1.default.urlencoded({ extended: true }));
app.use((0, express_mongo_sanitize_1.default)());
// API Routes Mounting
app.use('/api/v1/auth', auth_routes_1.default);
app.use('/api/v1/patients', patients_routes_1.default);
app.use('/api/v1/doctors', doctors_routes_1.default);
app.use('/api/v1/appointments', appointments_routes_1.default);
app.use('/api/v1/emr', emr_routes_1.default);
app.use('/api/v1/billing', billing_routes_1.default);
app.use('/api/v1/laboratory', laboratory_routes_1.default);
app.use('/api/v1/pharmacy', pharmacy_routes_1.default);
app.use('/api/v1/ipd', ipd_routes_1.default);
app.use('/api/v1/inventory', inventory_routes_1.default);
app.use('/api/v1/notifications', notifications_routes_1.default);
app.use('/api/v1/analytics', analytics_routes_1.default);
app.use('/api/v1/ai', ai_routes_1.default);
// Base Health Check
app.get('/health', (req, res) => {
    res.status(200).json({ status: 'OK', environment: config_1.config.nodeEnv });
});
// Global Error Handler
app.use(error_1.errorHandler);
// Start Server
const PORT = config_1.config.port;
server.listen(PORT, () => {
    console.log(`Hospital Operating System Server running on port ${PORT} in ${config_1.config.nodeEnv} mode`);
});
exports.default = app;
