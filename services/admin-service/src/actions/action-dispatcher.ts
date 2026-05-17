import { Kafka } from 'kafkajs';

export interface AdminAction {
    targetType: 'user' | 'seller' | 'buyer' | 'session' | 'payment' | 'node' | 'wallet' | 'transaction' | 'vpn_node' | 'network' | 'system' | 'incident';
    targetId: string;
    action: string;
    payload?: any;
    adminId: string;
}

export class ActionDispatcher {
    private producer;

    constructor(kafka: Kafka) {
        this.producer = kafka.producer();
    }

    async connect() {
        await this.producer.connect();
    }

    async disconnect() {
        await this.producer.disconnect();
    }

    async dispatch(action: AdminAction) {
        console.log(`[ActionDispatcher] Dispatching ${action.action} for ${action.targetType} ${action.targetId}`);
        
        await this.producer.send({
            topic: 'dm.admin.command',
            messages: [
                {
                    key: action.targetId,
                    value: JSON.stringify({
                        ...action,
                        timestamp: new Date().toISOString()
                    })
                }
            ]
        });

        // Also log to audit database here in a real scenario
        
        return { success: true, dispatchedAt: new Date().toISOString() };
    }
}
