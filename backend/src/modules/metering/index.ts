import { getRedis } from '../../db/redis.js';
import { createConsumer } from '../../events/kafka.js';

interface UsageTick {
  session_id: string;
  bytes_in: number;
  bytes_out: number;
  timestamp: string;
}

export async function startMeteringProcessor() {
  const consumer = await createConsumer('metering-processor');
  if (!consumer) {
    console.warn('[Metering] Kafka not available — metering disabled');
    return;
  }

  await consumer.subscribe({ topic: 'dm.usage.ticks', fromBeginning: false });

  await consumer.run({
    eachMessage: async ({ topic, message }) => {
      if (!message.value) return;
      try {
        const tick: UsageTick = JSON.parse(message.value.toString());
        const totalBytes = tick.bytes_in + tick.bytes_out;

        const redis = getRedis();
        if (redis) {
          await redis.incrby(`session:${tick.session_id}:usage`, totalBytes);
        }
      } catch (err) {
        console.error('[Metering] Error processing usage tick:', err);
      }
    },
  });
}

export async function checkSessionExhaustion(sessionId: string, quotaBytes: number): Promise<boolean> {
  const redis = getRedis();
  if (!redis) return false;

  const val = await redis.get(`session:${sessionId}:usage`);
  if (!val) return false;

  const used = parseInt(val, 10);
  const exhausted = used >= quotaBytes;

  if (exhausted) {
    console.log(`[Metering] Session ${sessionId} exhausted! Used ${used} / Quota ${quotaBytes}`);
  }

  return exhausted;
}
