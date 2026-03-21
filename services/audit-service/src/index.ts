import { Kafka, Consumer, EachMessageHandler } from 'kafkajs';
import pkg from 'pg';
const { Pool } = pkg;

const kafka = new Kafka({
  clientId: 'audit-service',
  brokers: [process.env.KAFKA_URL || 'kafka:9092']
});

const pool = new Pool({
  connectionString: process.env.DATABASE_URL
});

const DLQ_TOPIC = 'dm.audit.log.dlq';

class AuditConsumer {
  private consumer: Consumer;

  constructor() {
    this.consumer = kafka.consumer({ groupId: 'audit-group' });
  }

  async start() {
    await this.consumer.connect();
    await this.consumer.subscribe({ topic: 'dm.audit.log', fromBeginning: true });

    await this.consumer.run({
      eachMessage: this.handleMessage
    });

    console.log('Audit Service (TS) started and consuming bits...');
  }

  private handleMessage: EachMessageHandler = async ({ topic, partition, message }) => {
    const rawValue = message.value?.toString();
    if (!rawValue) return;

    try {
      const event = JSON.parse(rawValue);
      console.log(`[Audit] Processing ${event.action} from ${event.service}`);

      await pool.query(
        'INSERT INTO audit.audit_log (service, actor_id, action, resource_type, resource_id, new_value) VALUES ($1, $2, $3, $4, $5, $6)',
        [
          event.service || 'unknown',
          event.actor_id || null,
          event.action || 'UNKNOWN',
          event.resource_type || null,
          event.resource_id || null,
          event.payload ? JSON.stringify(event.payload) : null
        ]
      );
    } catch (err) {
      console.error('[Audit] Error processing message, sending to DLQ:', err);
      await this.sendToDLQ(rawValue, err);
    }
  };

  private async sendToDLQ(value: string, error: any) {
    const producer = kafka.producer();
    try {
      await producer.connect();
      await producer.send({
        topic: DLQ_TOPIC,
        messages: [{
          value: JSON.stringify({
            original_message: value,
            error: error.message,
            timestamp: new Date().toISOString()
          })
        }]
      });
    } catch (dlqErr) {
      console.error('[Audit] FATAL: Failed to send to DLQ', dlqErr);
    } finally {
      await producer.disconnect();
    }
  }
}

const auditConsumer = new AuditConsumer();
auditConsumer.start().catch(err => {
  console.error('[Audit] Fatal startup error', err);
  process.exit(1);
});
