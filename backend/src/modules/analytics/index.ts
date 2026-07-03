import { pool } from '../../db/client.js';
import { createConsumer } from '../../events/kafka.js';

export async function startAnalyticsAggregator() {
  const consumer = await createConsumer('analytics-aggregator');
  if (!consumer) {
    console.warn('[Analytics] Kafka not available — analytics aggregation disabled');
    return;
  }

  await consumer.subscribe({ topics: ['dm.session.completed', 'dm.payment.completed'], fromBeginning: false });

  await consumer.run({
    eachMessage: async ({ topic, message }) => {
      if (!message.value) return;
      try {
        const event = JSON.parse(message.value.toString());

        if (topic === 'dm.session.completed') {
          await pool.query(
            `INSERT INTO analytics.metrics (metric_name, metric_value, updated_at)
             VALUES ('total_sessions', 1, CURRENT_TIMESTAMP)
             ON CONFLICT (metric_name) DO UPDATE
             SET metric_value = analytics.metrics.metric_value + 1,
                 updated_at = CURRENT_TIMESTAMP`
          );
        } else if (topic === 'dm.payment.completed') {
          const amount = event.amount || 0;
          await pool.query(
            `INSERT INTO analytics.metrics (metric_name, metric_value, updated_at)
             VALUES ('total_revenue', $1, CURRENT_TIMESTAMP)
             ON CONFLICT (metric_name) DO UPDATE
             SET metric_value = analytics.metrics.metric_value + $1,
                 updated_at = CURRENT_TIMESTAMP`,
            [amount]
          );
        }
      } catch (err) {
        console.error('[Analytics] Failed to process event:', err);
      }
    },
  });
}
