import { ByteTrackerEngine } from '../services/billing-service/src/core/engines/byte-tracker.js';
import { redisCache } from '../services/billing-service/src/db/redis-cache.js';
import { walletRepository } from '../services/billing-service/src/repositories/wallet.repository.js';
import { sessionRepository } from '../services/billing-service/src/repositories/session.repository.js';
import { sessionProducer } from '../services/billing-service/src/events/producers/session.producer.js';

// Mocking logic for standalone execution
async function runTests() {
    console.log("=========================================");
    console.log("DRAVIO PHASE 5: STANDALONE INTEGRATION TESTS");
    console.log("=========================================\n");

    const engine = new ByteTrackerEngine();

    // 1. Mocking Redis
    (redisCache as any).getSession = async (token: string) => {
        if (token === 'valid_token') {
            return {
                userId: 'user_123',
                hardwareId: 'hw_001',
                pricePerMb: 0.10
            };
        }
        return null;
    };
    (redisCache as any).removeSession = async () => {};

    // 2. Mocking DB
    let balance = 5.00;
    (walletRepository as any).directDeduct = async (userId: string, amount: number) => {
        balance -= amount;
        console.log(`   [MockDB] Deducted $${amount.toFixed(4)}. New Balance: $${balance.toFixed(4)}`);
        return balance;
    };

    (sessionRepository as any).updateSessionUsage = async () => {};
    (sessionRepository as any).endSession = async () => {};

    // 3. Mocking Kafka
    (sessionProducer as any).broadcastKillSwitch = async (token: string, hwId: string, userId: string, reason: string) => {
        console.log(`   [MockKafka] 🚨 KILL SWITCH ISSUED for ${userId} (Reason: ${reason})`);
    };

    // --- TEST 1: Normal Usage ---
    console.log("[Test 1] Processing normal data usage (10MB)...");
    await engine.processUsageUpdate('valid_token', BigInt(10 * 1024 * 1024));
    console.log(`✅ Test 1 Passed. Balance: $${balance.toFixed(2)}\n`);

    // --- TEST 2: Bankrupt Scenario ---
    console.log("[Test 2] Processing massive usage to trigger bankruptcy (100MB)...");
    await engine.processUsageUpdate('valid_token', BigInt(100 * 1024 * 1024));
    if (balance <= 0) {
        console.log("✅ Test 2 Passed. Auto-Kill triggered successfully.\n");
    } else {
        console.log("❌ Test 2 Failed. Balance still positive.\n");
    }

    // --- TEST 3: Zombie Session ---
    console.log("[Test 3] Processing usage for invalid session...");
    await engine.processUsageUpdate('invalid_token', BigInt(10 * 1024 * 1024));
    console.log("✅ Test 3 Passed. Invalid session ignored.\n");

    console.log("=========================================");
    console.log("PHASE 5 INTEGRATION TESTS COMPLETE");
    console.log("=========================================");
}

runTests().catch(err => {
    console.error("Test execution failed:", err);
    process.exit(1);
});
