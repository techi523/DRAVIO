import { Kafka } from 'kafkajs';

export const kafka = new Kafka({
  clientId: 'billing-service-producer',
  brokers: [process.env.KAFKA_URL || 'localhost:9092']
});

const producer = kafka.producer();

export class SessionProducer {
  private connected = false;

  async connect() {
    if (!this.connected) {
      await producer.connect();
      this.connected = true;
    }
  }

  async broadcastKillSwitch(sessionToken: string, hardwareId: string, userId: string, reason: string) {
    await this.connect();
    await producer.send({
      topic: 'dm.session.kill',
      messages: [{ 
        value: JSON.stringify({ 
          sessionToken, 
          hardwareId, 
          userId, 
          reason,
          timestamp: new Date() 
        }) 
      }]
    });
    console.log(`B-Engine: Kill switch broadcasted for session ${sessionToken} (${reason})`);
  }
}

export const sessionProducer = new SessionProducer();
