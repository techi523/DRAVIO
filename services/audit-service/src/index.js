import { Kafka } from 'kafkajs';
import pkg from 'pg';
const { Client } = pkg;

const kafka = new Kafka({
  clientId: 'audit-service',
  brokers: [process.env.KAFKA_URL || 'localhost:9092']
});

const pgClient = new Client({
  connectionString: process.env.DATABASE_URL
});

async function start() {
  await pgClient.connect();
  const consumer = kafka.consumer({ groupId: 'audit-group' });

  await consumer.connect();
  await consumer.subscribe({ topic: 'dm.audit.log', fromBeginning: true });

  console.log('Audit Service consuming events...');

  await consumer.run({
    eachMessage: async ({ message }) => {
      const event = JSON.parse(message.value.toString());
      console.log('Logging audit event:', event.action);

      await pgClient.query(
        'INSERT INTO audit.audit_log (service, actor_id, action, resource_type, resource_id, new_value) VALUES ($1, $2, $3, $4, $5, $6)',
        [event.service, event.actor_id, event.action, event.resource_type, event.resource_id, event.payload]
      );
    },
  });
}

start().catch(console.error);
