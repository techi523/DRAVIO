"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.evaluateRiskScore = exports.generateDeviceFingerprint = void 0;
const generateDeviceFingerprint = (headers) => {
    const userAgent = headers['user-agent'] || 'unknown';
    const acceptLang = headers['accept-language'] || 'unknown';
    // Simplified fingerprinting logic
    return Buffer.from(`${userAgent}-${acceptLang}`).toString('base64');
};
exports.generateDeviceFingerprint = generateDeviceFingerprint;
const evaluateRiskScore = (fingerprint, ip) => {
    // Mock risk rules
    if (ip === '1.2.3.4')
        return 100; // Known malicious IP
    return 0; // Low risk
};
exports.evaluateRiskScore = evaluateRiskScore;
