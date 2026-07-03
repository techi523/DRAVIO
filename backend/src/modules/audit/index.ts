import { pool } from '../../db/client.js';
import { createConsumer } from '../../events/kafka.js';

export async function startAuditConsumer() {
  const consumer = await createConsumer('audit-service-group');
  if (!consumer) {
    console.warn('[Audit] Kafka not available — audit logging disabled');
    return;
  }

  await consumer.subscribe({ topic: 'dm.audit.log', fromBeginning: false });
  
  await consumer.run({
    eachMessage: async ({ topic, partition, message }) => {
      if (!message.value) return;
      try {
        const event = JSON.parse(message.value.toString());
        await pool.query(
          `INSERT INTO audit.audit_log (actor_id, action, service, resource_type, resource_id, metadata)
           VALUES ($1, $2, $3, $4, $5, $6)`,
          [event.actor_id, event.action, event.service, event.resource_type, event.resource_id, JSON.stringify(event.metadata || {})]
        );
      } catch (err) {
        console.error('[Audit] Failed to process event:', err);
      }
    },
  });
}
