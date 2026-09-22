"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.config = void 0;
const dotenv_1 = __importDefault(require("dotenv"));
const path_1 = __importDefault(require("path"));
// Load env variables
dotenv_1.default.config({ path: path_1.default.join(__dirname, '../../.env') });
exports.config = {
    port: parseInt(process.env.PORT || '5000', 10),
    mongoUri: process.env.MONGODB_URI || 'mongodb://localhost:27017/hms-saas',
    jwtSecret: process.env.JWT_SECRET || 'super_secret_jwt_key_change_me_in_production',
    jwtRefreshSecret: process.env.JWT_REFRESH_SECRET || 'super_secret_refresh_key_change_me_in_production',
    nodeEnv: process.env.NODE_ENV || 'development'
};
