"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
/// <reference types="@jest/globals" />
const globals_1 = require("@jest/globals");
const security_1 = require("../src/security");
(0, globals_1.describe)('Security Layer', () => {
    (0, globals_1.it)('should generate consistent fingerprints', () => {
        const headers = { 'user-agent': 'Mozilla/5.0', 'accept-language': 'en-US' };
        const fp1 = (0, security_1.generateDeviceFingerprint)(headers);
        const fp2 = (0, security_1.generateDeviceFingerprint)(headers);
        (0, globals_1.expect)(fp1).toBe(fp2);
    });
    (0, globals_1.it)('should flag malicious IPs', () => {
        const score = (0, security_1.evaluateRiskScore)('fp_abc', '1.2.3.4');
        (0, globals_1.expect)(score).toBe(100);
    });
});
