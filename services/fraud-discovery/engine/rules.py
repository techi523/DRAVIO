from pydantic import BaseModel
from typing import List, Optional

class SecurityEvent(BaseModel):
    user_id: str
    event_type: str
    risk_score: float
    description: str

class FraudRuleEngine:
    def evaluate_payment_risk(self, user_id: str, failed_count: int) -> Optional[SecurityEvent]:
        if failed_count > 3:
            return SecurityEvent(
                user_id=user_id,
                event_type="MULTIPLE_FAILED_PAYMENTS",
                risk_score=0.9,
                description=f"User has {failed_count} failed payments in 1h"
            )
        return None

    def evaluate_travel_risk(self, user_id: str, last_country: str, current_country: str, time_diff_minutes: int) -> Optional[SecurityEvent]:
        # Simple "Impossible Travel" rule
        if last_country != current_country and time_diff_minutes < 60:
            return SecurityEvent(
                user_id=user_id,
                event_type="IMPOSSIBLE_TRAVEL",
                risk_score=0.8,
                description=f"Location changed from {last_country} to {current_country} in {time_diff_minutes}min"
            )
        return None
