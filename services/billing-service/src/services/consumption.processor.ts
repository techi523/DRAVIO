import { Kafka } from 'kafkajs';
import { walletRepository } from '../repositories/wallet.repository.js';

const kafka = new Kafka({
  clientId: 'billing-service',
  brokers: [process.env.KAFKA_URL || 'localhost:9092']
});

const consumer = kafka.consumer({ groupId: 'billing-group' });

// Price per MB in KES
const PRICE_PER_MB = 0.01;

export async function startConsumptionProcessor() {
  if (!process.env.KAFKA_URL) {
    console.warn('[Billing Consumer] KAFKA_URL not set — Kafka consumption processor disabled. Wallet deduction via API only.');
    return;
  }

  let connected = false;
  let retries = 5;
  while (!connected && retries > 0) {
    try {
      console.log(`[Billing Consumer] Connecting to Kafka... (${retries} attempts remaining)`);
      await consumer.connect();
      connected = true;
      console.log("[Billing Consumer] Successfully connected to Kafka!");
    } catch (err) {
      retries--;
      if (retries === 0) {
        console.warn(`[Billing Consumer] Could not connect to Kafka after retries — running in degraded mode (no real-time billing). Error: ${err}`);
        return;
      }
      console.log(`[Billing Consumer] Kafka connection failed, retrying in 5 seconds...`);
      await new Promise(resolve => setTimeout(resolve, 5000));
    }
  }

  await consumer.subscribe({ topic: 'dm.metering.update', fromBeginning: false });

  await consumer.run({
    eachMessage: async ({ message }) => {
      if (!message.value) return;
      
      const update = JSON.parse(message.value.toString());
      const { userId, bytesUsed } = update;
      const mbUsed = bytesUsed / (1024 * 1024);
      const cost = mbUsed * PRICE_PER_MB;

      try {
        // Real-time wallet deduction utilizing atomic database locking
        const newBalance = await walletRepository.directDeduct(userId, cost);
        console.log(`[Billing Consumer] Deducted $${cost.toFixed(4)} from user ${userId}. Remaining: $${newBalance.toFixed(4)}`);
      } catch (err: any) {
        if (err.message === "INSUFFICIENT_FUNDS") {
          console.log(`[Billing Consumer] User ${userId} balance depleted. Sending kill signal.`);
          await killSession(userId);
        } else {
          console.error('[Billing Consumer] Failed to process billing update:', err);
        }
      }
    },
  });
}

async function killSession(userId: string) {
  try {
    const producer = kafka.producer();
    await producer.connect();
    await producer.send({
      topic: 'dm.session.kill',
      messages: [{ value: JSON.stringify({ userId, timestamp: new Date() }) }]
    });
    await producer.disconnect();
  } catch (err) {
    console.warn(`[Billing Consumer] Could not emit session kill event via Kafka: ${err}`);
  }
}
