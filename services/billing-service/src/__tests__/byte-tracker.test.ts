/**
 * DRAVIO Phase 5 – Automated Testing Suite
 * 
 * Integration tests for the ByteTrackerEngine (Core Billing Engine).
 * Validates: usage tracking, wallet deductions, auto-kill trigger,
 * race condition safety, and insufficient-funds handling.
 */

// ===== MOCKING EXTERNAL DEPENDENCIES =====
const mockDirectDeduct = jest.fn();
const mockBroadcastKillSwitch = jest.fn();
const mockEndSession = jest.fn();
const mockRemoveSession = jest.fn();
const mockUpdateSessionUsage = jest.fn();
const mockGetSession = jest.fn();

jest.mock('../db/redis-cache.js', () => ({
  redisCache: {
    getSession: mockGetSession,
    removeSession: mockRemoveSession
  }
}));

jest.mock('../repositories/wallet.repository.js', () => ({
  walletRepository: {
    directDeduct: mockDirectDeduct
  }
}));

jest.mock('../repositories/session.repository.js', () => ({
  sessionRepository: {
    updateSessionUsage: mockUpdateSessionUsage,
    endSession: mockEndSession
  }
}));

jest.mock('../events/producers/session.producer.js', () => ({
  sessionProducer: {
    broadcastKillSwitch: mockBroadcastKillSwitch
  }
}));

// ===== TEST SUITE =====

import { ByteTrackerEngine } from '../core/engines/byte-tracker.js';

const mockSession = {
  userId: 'user_abc123',
  hardwareId: 'hw_node_001',
  pricePerMb: 0.05
};

describe('ByteTrackerEngine', () => {
  let engine: ByteTrackerEngine;

  beforeEach(() => {
    engine = new ByteTrackerEngine();
    jest.clearAllMocks();
    mockGetSession.mockResolvedValue(mockSession);
  });

  // ===== CORE BILLING ACCURACY =====
  describe('processUsageUpdate – Core Billing Accuracy', () => {
    it('should deduct correct cost for bytes consumed', async () => {
      const bytes = BigInt(10 * 1024 * 1024); // 10 MB
      const expectedCost = (10 * 0.05); // $0.50
      mockDirectDeduct.mockResolvedValue(5.00); // $5 remaining

      await engine.processUsageUpdate('session_001', bytes);

      expect(mockDirectDeduct).toHaveBeenCalledWith('user_abc123', expect.closeTo(expectedCost, 5));
      expect(mockUpdateSessionUsage).toHaveBeenCalledWith('session_001', bytes, expect.closeTo(expectedCost, 5));
    });

    it('should skip zero-cost micro-reports to prevent DB spam', async () => {
      const bytes = BigInt(0); // 0 bytes
      await engine.processUsageUpdate('session_001', bytes);

      expect(mockDirectDeduct).not.toHaveBeenCalled();
    });
  });

  // ===== AUTO-KILL SWITCH =====
  describe('processUsageUpdate – Zero-Balance Auto-Kill', () => {
    it('should trigger kill switch when balance reaches exactly zero', async () => {
      mockDirectDeduct.mockResolvedValue(0.00);

      await engine.processUsageUpdate('session_001', BigInt(1024 * 1024));

      expect(mockBroadcastKillSwitch).toHaveBeenCalledWith('session_001', 'hw_node_001', 'user_abc123', 'INSUFFICIENT_FUNDS');
      expect(mockEndSession).toHaveBeenCalledWith('session_001', 'KILLED');
      expect(mockRemoveSession).toHaveBeenCalledWith('session_001');
    });

    it('should trigger kill switch when balance goes negative', async () => {
      mockDirectDeduct.mockResolvedValue(-0.25);

      await engine.processUsageUpdate('session_001', BigInt(5 * 1024 * 1024));

      expect(mockBroadcastKillSwitch).toHaveBeenCalledTimes(1);
      expect(mockEndSession).toHaveBeenCalledWith('session_001', 'KILLED');
    });

    it('should NOT trigger kill switch when user has sufficient balance', async () => {
      mockDirectDeduct.mockResolvedValue(2.50);

      await engine.processUsageUpdate('session_001', BigInt(1024 * 1024));

      expect(mockBroadcastKillSwitch).not.toHaveBeenCalled();
      expect(mockEndSession).not.toHaveBeenCalled();
    });
  });

  // ===== ZOMBIE SESSION GUARD =====
  describe('processUsageUpdate – Zombie Session Guard', () => {
    it('should gracefully ignore reports for untracked/expired sessions', async () => {
      mockGetSession.mockResolvedValue(null); // Session is gone (expired/killed)

      await engine.processUsageUpdate('zombie_session_999', BigInt(5 * 1024 * 1024));

      expect(mockDirectDeduct).not.toHaveBeenCalled();
      expect(mockBroadcastKillSwitch).not.toHaveBeenCalled();
    });
  });

  // ===== RACE CONDITION SAFETY (DB-Level INSUFFICIENT_FUNDS) =====
  describe('processUsageUpdate – Race Condition Safety', () => {
    it('should handle DB-level INSUFFICIENT_FUNDS error from concurrent deductions', async () => {
      mockDirectDeduct.mockRejectedValue(new Error('INSUFFICIENT_FUNDS'));

      await engine.processUsageUpdate('session_001', BigInt(10 * 1024 * 1024));

      expect(mockBroadcastKillSwitch).toHaveBeenCalledWith('session_001', 'hw_node_001', 'user_abc123', 'INSUFFICIENT_FUNDS');
      expect(mockEndSession).toHaveBeenCalledWith('session_001', 'KILLED');
    });
  });

  // ===== CONCURRENT HIGH-LOAD TEST =====
  describe('processUsageUpdate – Concurrent Load', () => {
    it('should handle 50 concurrent usage reports without error', async () => {
      mockDirectDeduct.mockResolvedValue(10.00);

      const promises = Array.from({ length: 50 }, (_, i) =>
        engine.processUsageUpdate(`session_${i}`, BigInt(1024 * 1024))
      );

      await expect(Promise.all(promises)).resolves.not.toThrow();
      expect(mockDirectDeduct).toHaveBeenCalledTimes(50);
    });
  });
});
