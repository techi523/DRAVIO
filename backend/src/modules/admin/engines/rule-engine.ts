import { ActionDispatcher } from '../actions/action-dispatcher.js';

export type RuleCondition = 'BALANCE_BELOW' | 'TRAFFIC_ABOVE' | 'THREAT_SCORE_ABOVE';
export type RuleActionType = 'DISCONNECT' | 'SUSPEND_USER' | 'FREEZE_WALLET' | 'ALERT_ADMIN';

export interface Rule {
    id: string;
    name: string;
    condition: RuleCondition;
    threshold: number;
    action: RuleActionType;
    active: boolean;
}

export class RuleEngine {
    private actionDispatcher: ActionDispatcher | null = null;
    
    public rules: Rule[] = [
        {
            id: '1',
            name: 'Auto-Disconnect Bankrupt',
            condition: 'BALANCE_BELOW',
            threshold: 0,
            action: 'DISCONNECT',
            active: true
        },
        {
            id: '2',
            name: 'Suspend High Threat',
            condition: 'THREAT_SCORE_ABOVE',
            threshold: 90,
            action: 'SUSPEND_USER',
            active: true
        }
    ];

    setDispatcher(dispatcher: ActionDispatcher) {
        this.actionDispatcher = dispatcher;
    }

    addRule(rule: Rule) {
        this.rules.push(rule);
    }

    async evaluate(fact: { type: string; value: number; context: any }) {
        const matchingRules = this.rules.filter(r => r.active && this.checkCondition(r, fact));
        
        for (const rule of matchingRules) {
            console.log(`[RuleEngine] Rule triggered: ${rule.name} for context`, fact.context);
            await this.executeAction(rule.action, fact.context);
        }
    }

    private checkCondition(rule: Rule, fact: { type: string; value: number }) {
        if (rule.condition === 'BALANCE_BELOW' && fact.type === 'balance') {
            return fact.value < rule.threshold;
        }
        if (rule.condition === 'THREAT_SCORE_ABOVE' && fact.type === 'threat') {
            return fact.value > rule.threshold;
        }
        if (rule.condition === 'TRAFFIC_ABOVE' && fact.type === 'traffic') {
            return fact.value > rule.threshold;
        }
        return false;
    }

    private async executeAction(action: RuleActionType, context: any) {
        if (!this.actionDispatcher) {
            console.warn('[RuleEngine] ActionDispatcher not set, cannot execute action:', action);
            return;
        }

        switch (action) {
            case 'DISCONNECT':
                if (context.sessionId) {
                    await this.actionDispatcher.dispatch({
                        targetType: 'session',
                        targetId: context.sessionId,
                        action: 'terminate',
                        adminId: 'system-automation'
                    });
                }
                break;
            case 'SUSPEND_USER':
                 if (context.userId) {
                    await this.actionDispatcher.dispatch({
                        targetType: 'user',
                        targetId: context.userId,
                        action: 'suspend',
                        adminId: 'system-automation'
                    });
                }
                break;
            case 'FREEZE_WALLET':
                 if (context.userId) {
                    await this.actionDispatcher.dispatch({
                        targetType: 'user',
                        targetId: context.userId,
                        action: 'freeze_wallet',
                        adminId: 'system-automation'
                    });
                }
                break;
            case 'ALERT_ADMIN':
                console.log(`[RuleEngine] ALERT: Automation triggered for ${context.userId}`);
                break;
        }
    }
}

export const ruleEngine = new RuleEngine();
