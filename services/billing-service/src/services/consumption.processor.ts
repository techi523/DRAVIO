import { Kafka } from 'kafkajs';
import mongoose from 'mongoose';
import axios from 'axios';

const kafka = new Kafka({
  clientId: 'billing-service',
  brokers: [process.env.KAFKA_URL || 'localhost:9092']
});

const consumer = kafka.consumer({ groupId: 'billing-group' });

// Price per MB in KES
const PRICE_PER_MB = 0.01;

export async function startConsumptionProcessor() {
  let connected = false;
  let retries = 10;
  while (!connected && retries > 0) {
    try {
      console.log(`[Billing Consumer] Connecting to Kafka... (${retries} attempts remaining)`);
      await consumer.connect();
      connected = true;
      console.log("[Billing Consumer] Successfully connected to Kafka!");
    } catch (err) {
      retries--;
      if (retries === 0) {
        throw new Error(`Failed to connect to Kafka after multiple retries: ${err}`);
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
        // Direct DB update (Assuming Shared MongoDB or API call to Payment Service)
        // For this demo, we'll assume we deduct via an API call to Payment Service
        const response = await axios.post(`${process.env.PAYMENT_SERVICE_URL}/v1/payments/wallet/deduct`, {
          userId,
          amount: cost,
          reason: `Internet Usage: ${mbUsed.toFixed(2)} MB`
        });

        if (response.data.balance <= 0) {
          console.log(`User ${userId} balance depleted. Sending kill signal.`);
          await killSession(userId);
        }
      } catch (err) {
        console.error('Failed to process billing update:', err);
      }
    },
  });
}

async function killSession(userId: string) {
  const producer = kafka.producer();
  await producer.connect();
  await producer.send({
    topic: 'dm.session.kill',
    messages: [{ value: JSON.stringify({ userId, timestamp: new Date() }) }]
  });
  await producer.disconnect();
}
