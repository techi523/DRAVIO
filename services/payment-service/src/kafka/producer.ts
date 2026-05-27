import { Kafka, Producer } from 'kafkajs';

const kafka = new Kafka({
  clientId: 'payment-service',
  brokers: process.env.KAFKA_BROKERS ? process.env.KAFKA_BROKERS.split(',') : ['kafka:9092']
});

let producerInstance: Producer | null = null;

export const producer = {
  connect: async () => {
    if (!producerInstance) {
      producerInstance = kafka.producer();
      await producerInstance.connect();
      console.log('Payment service connected to Kafka');
    }
  },
  send: async (payload: { topic: string, messages: { key?: string, value: string }[] }) => {
    if (!producerInstance) {
      await producer.connect();
    }
    await producerInstance!.send(payload);
  },
  disconnect: async () => {
    if (producerInstance) {
      await producerInstance.disconnect();
      producerInstance = null;
    }
  }
};
