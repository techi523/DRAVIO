import { Kafka, Producer, Consumer } from 'kafkajs';

let kafka: Kafka | null = null;
let producerInstance: Producer | null = null;

function getKafka(): Kafka | null {
  const brokers = process.env.KAFKA_URL;
  if (!brokers) {
    return null;
  }
  if (!kafka) {
    kafka = new Kafka({
      clientId: 'dravio-backend',
      brokers: brokers.split(','),
    });
  }
  return kafka;
}

export async function getProducer(): Promise<Producer | null> {
  if (producerInstance) return producerInstance;
  
  const k = getKafka();
  if (!k) {
    console.warn('[Kafka] KAFKA_URL not set — event publishing disabled');
    return null;
  }

  try {
    producerInstance = k.producer();
    await producerInstance.connect();
    console.log('[Kafka] Producer connected');
    return producerInstance;
  } catch (err) {
    console.warn('[Kafka] Failed to connect producer:', err);
    return null;
  }
}

export async function sendEvent(topic: string, key: string, value: object): Promise<void> {
  const producer = await getProducer();
  if (!producer) {
    console.warn(`[Kafka] Skipping event ${topic} — Kafka unavailable`);
    return;
  }
  try {
    await producer.send({
      topic,
      messages: [{ key, value: JSON.stringify(value) }],
    });
  } catch (err) {
    console.warn(`[Kafka] Failed to send event to ${topic}:`, err);
  }
}

export async function createConsumer(groupId: string): Promise<Consumer | null> {
  const k = getKafka();
  if (!k) return null;
  
  try {
    const consumer = k.consumer({ groupId });
    await consumer.connect();
    return consumer;
  } catch (err) {
    console.warn(`[Kafka] Failed to create consumer ${groupId}:`, err);
    return null;
  }
}
