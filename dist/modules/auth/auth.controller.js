"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.refresh = exports.login = exports.signup = void 0;
const jsonwebtoken_1 = __importDefault(require("jsonwebtoken"));
const user_model_1 = require("./user.model");
const hospital_model_1 = require("./hospital.model");
const common_1 = require("../../common");
const config_1 = require("../../config");
// Helper to generate access token
const generateAccessToken = (user) => {
    return jsonwebtoken_1.default.sign({ id: user._id, email: user.email, role: user.role, hospitalId: user.hospitalId }, config_1.config.jwtSecret, { expiresIn: '15m' });
};
// Helper to generate refresh token
const generateRefreshToken = (user) => {
    return jsonwebtoken_1.default.sign({ id: user._id, hospitalId: user.hospitalId }, config_1.config.jwtRefreshSecret, { expiresIn: '7d' });
};
// @desc    Register a new Hospital and Hospital Admin
// @route   POST /api/v1/auth/signup
// @access  Public
exports.signup = (0, common_1.asyncHandler)(async (req, res) => {
    const { hospitalName, subdomain, email, password, firstName, lastName } = req.body;
    if (!hospitalName || !subdomain || !email || !password || !firstName || !lastName) {
        throw new common_1.AppError('Please provide all required fields', 400);
    }
    // Check if hospital subdomain is taken
    const existingHospital = await hospital_model_1.Hospital.findOne({ subdomain });
    if (existingHospital) {
        throw new common_1.AppError('Hospital subdomain is already registered', 400);
    }
    // Check if user email is taken
    const existingUser = await user_model_1.User.findOne({ email });
    if (existingUser) {
        throw new common_1.AppError('User with this email is already registered', 400);
    }
    // Create Hospital
    const newHospital = await hospital_model_1.Hospital.create({
        name: hospitalName,
        subdomain,
        isActive: true
    });
    // Create Hospital Admin User
    const newAdmin = await user_model_1.User.create({
        hospitalId: newHospital._id,
        email,
        passwordHash: password, // Pre-save hook hashes this
        role: 'Hospital Admin',
        name: { first: firstName, last: lastName }
    });
    return (0, common_1.sendResponse)(res, 201, 'Hospital and Admin registered successfully', {
        hospital: {
            id: newHospital._id,
            name: newHospital.name,
            subdomain: newHospital.subdomain
        },
        user: {
            id: newAdmin._id,
            email: newAdmin.email,
            role: newAdmin.role,
            name: newAdmin.name
        }
    });
});
// @desc    User Login
// @route   POST /api/v1/auth/login
// @access  Public
exports.login = (0, common_1.asyncHandler)(async (req, res) => {
    const { email, password } = req.body;
    if (!email || !password) {
        throw new common_1.AppError('Please provide email and password', 400);
    }
    const user = await user_model_1.User.findOne({ email }).select('+passwordHash');
    if (!user || user.isDeleted || !user.isActive) {
        throw new common_1.AppError('Invalid credentials', 401);
    }
    const isMatch = await user.comparePassword(password);
    if (!isMatch) {
        throw new common_1.AppError('Invalid credentials', 401);
    }
    // Update last login
    user.lastLogin = new Date();
    await user.save();
    // Generate tokens
    const accessToken = generateAccessToken(user);
    const refreshToken = generateRefreshToken(user);
    return (0, common_1.sendResponse)(res, 200, 'Login successful', {
        user: {
            id: user._id,
            email: user.email,
            role: user.role,
            name: user.name,
            hospitalId: user.hospitalId
        },
        accessToken,
        refreshToken
    });
});
// @desc    Refresh Access Token
// @route   POST /api/v1/auth/refresh
// @access  Public
exports.refresh = (0, common_1.asyncHandler)(async (req, res) => {
    const { refreshToken } = req.body;
    if (!refreshToken) {
        throw new common_1.AppError('Refresh token is required', 400);
    }
    try {
        const decoded = jsonwebtoken_1.default.verify(refreshToken, config_1.config.jwtRefreshSecret);
        const user = await user_model_1.User.findById(decoded.id);
        if (!user || user.isDeleted || !user.isActive) {
            throw new common_1.AppError('Invalid refresh token session', 401);
        }
        const accessToken = generateAccessToken(user);
        const newRefreshToken = generateRefreshToken(user);
        return (0, common_1.sendResponse)(res, 200, 'Token refreshed successfully', {
            accessToken,
            refreshToken: newRefreshToken
        });
    }
    catch (error) {
        throw new common_1.AppError('Invalid or expired refresh token', 401);
    }
});
