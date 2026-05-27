import * as fs from 'fs';
import * as path from 'path';

export interface SecurityScanResult {
    success: boolean;
    jwtEnforceOk: boolean;
    corsOk: boolean;
    fallbackSecretsOk: boolean;
    errors: string[];
    logs: string[];
}

export async function runSecurityScan(): Promise<SecurityScanResult> {
    const report: SecurityScanResult = {
        success: false,
        jwtEnforceOk: false,
        corsOk: false,
        fallbackSecretsOk: false,
        errors: [],
        logs: [],
    };

    report.logs.push("[SECURITY] Starting monorepo static security scan...");

    const baseDir = path.resolve(__dirname, '../../');
    const servicesDir = path.join(baseDir, 'services');

    try {
        // 1. Scan for hardcoded fallbacks like dev-secret-key-12345 in source files
        const secretsPattern = /'dev-secret-key-12345'|"dev-secret-key-12345"/;
        let foundFallback = false;

        const scanDirectory = (dir: string) => {
            const items = fs.readdirSync(dir);
            for (const item of items) {
                const fullPath = path.join(dir, item);
                const stat = fs.statSync(fullPath);
                
                if (stat.isDirectory()) {
                    if (item !== 'node_modules' && item !== 'dist' && item !== '.git') {
                        scanDirectory(fullPath);
                    }
                } else if (stat.isFile() && (item.endsWith('.ts') || item.endsWith('.js'))) {
                    const content = fs.readFileSync(fullPath, 'utf-8');
                    if (secretsPattern.test(content)) {
                        foundFallback = true;
                        report.errors.push(`Fallback secret found in: ${path.relative(baseDir, fullPath)}`);
                    }
                }
            }
        };

        scanDirectory(servicesDir);
        
        if (!foundFallback) {
            report.fallbackSecretsOk = true;
            report.logs.push("[SECURITY] Scan for hardcoded 'dev-secret-key-12345' secrets: CLEAN.");
        }
    } catch (err: any) {
        report.errors.push(`Secret fallback scan error: ${err.message}`);
    }

    try {
        // 2. Verify gateway CORS is not wildcard '*'
        const gatewayIndex = path.join(servicesDir, 'gateway-service', 'src', 'index.ts');
        if (fs.existsSync(gatewayIndex)) {
            const content = fs.readFileSync(gatewayIndex, 'utf-8');
            
            // Check if CORS register uses processes/env variable origins
            const hasEnvOrigins = content.includes('process.env.CORS_ORIGINS') || content.includes('allowedOrigins');
            const hasWildcardCors = /origin:\s*['"]\*['"]/.test(content) && content.includes('fastify.register(cors');
            
            if (hasEnvOrigins && !hasWildcardCors) {
                report.corsOk = true;
                report.logs.push("[SECURITY] Gateway CORS allowlist domain validation: SECURE.");
            } else {
                report.errors.push("Gateway CORS is configured with wildcard '*' or lacks environment allowlisting!");
            }
        } else {
            report.errors.push("Gateway service index.ts not found for CORS inspection!");
        }
    } catch (err: any) {
        report.errors.push(`CORS audit error: ${err.message}`);
    }

    try {
        // 3. Verify JWT_SECRET startup crashes are configured
        let checkedServices = 0;
        let failingServices = 0;

        const targetFiles = [
            'auth-service/src/index.ts',
            'user-service/src/index.ts',
            'billing-service/src/index.ts',
            'payment-service/src/index.ts',
            'gateway-service/src/index.ts',
            'admin-service/src/index.ts'
        ];

        for (const file of targetFiles) {
            const filePath = path.join(servicesDir, file);
            if (fs.existsSync(filePath)) {
                checkedServices++;
                const content = fs.readFileSync(filePath, 'utf-8');
                const hasCrash = content.includes('throw new Error') && content.includes('JWT_SECRET');
                if (!hasCrash) {
                    failingServices++;
                    report.errors.push(`Service ${file} does not contain crash-on-missing-JWT_SECRET guard!`);
                }
            }
        }

        if (checkedServices > 0 && failingServices === 0) {
            report.jwtEnforceOk = true;
            report.logs.push("[SECURITY] Mandated JWT_SECRET startup crash guards: SECURE.");
        }
    } catch (err: any) {
        report.errors.push(`JWT startup guard audit error: ${err.message}`);
    }

    report.success = report.fallbackSecretsOk && report.corsOk && report.jwtEnforceOk;
    report.logs.push(`[SECURITY] Security scan concluded. Overall: ${report.success ? 'PASSED' : 'FAILED'}`);
    return report;
}
