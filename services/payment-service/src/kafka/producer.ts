import { Kafka, Producer } from 'kafkajs';

const kafka = new Kafka({
  clientId: 'payment-service',
  brokers: process.env.KAFKA_BROKERS ? process.env.KAFKA_BROKERS.split(',') : ['kafka:9092']
});

let producerInstance: Producer | null = null;
const kafkaAvailable = !!process.env.KAFKA_BROKERS || !!process.env.KAFKA_URL;

export const producer = {
  connect: async () => {
    if (!kafkaAvailable) {
      console.warn('[Payment] Kafka not configured — event publishing disabled.');
      return;
    }
    if (!producerInstance) {
      producerInstance = kafka.producer();
      try {
        await producerInstance.connect();
        console.log('Payment service connected to Kafka');
      } catch (err) {
        console.warn(`[Payment] Kafka connect failed, continuing without event publishing: ${err}`);
        producerInstance = null;
      }
    }
  },
  send: async (payload: { topic: string, messages: { key?: string, value: string }[] }) => {
    if (!producerInstance) {
      console.warn(`[Payment] Kafka unavailable — skipping event publish to ${payload.topic}`);
      return;
    }
    try {
      await producerInstance.send(payload);
    } catch (err) {
      console.warn(`[Payment] Failed to publish Kafka event: ${err}`);
    }
  },
  disconnect: async () => {
    if (producerInstance) {
      await producerInstance.disconnect();
      producerInstance = null;
    }
  }
};

