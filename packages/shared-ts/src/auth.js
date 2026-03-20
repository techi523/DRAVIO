"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.authMiddleware = void 0;
const jsonwebtoken_1 = __importDefault(require("jsonwebtoken"));
const JWT_SECRET = process.env.JWT_SECRET || 'super-secret';
const authMiddleware = async (request, reply) => {
    try {
        const token = request.headers.authorization?.split(' ')[1];
        if (!token)
            throw new Error('Unauthorized');
        const decoded = jsonwebtoken_1.default.verify(token, JWT_SECRET);
        request.user = decoded;
    }
    catch (err) {
        reply.status(401).send({ error: 'Invalid or missing token' });
    }
};
exports.authMiddleware = authMiddleware;
