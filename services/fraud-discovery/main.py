from fastapi import FastAPI, BackgroundTasks
from engine.rules import FraudRuleEngine, SecurityEvent
import json

app = FastAPI(title="DRAVIO Fraud Discovery Service")
engine = FraudRuleEngine()

@app.get("/health")
async def health():
    return {"status": "ok", "service": "fraud-discovery"}

@app.post("/v1/internal/analyze/payment")
async def analyze_payment(user_id: str, failed_count: int):
    event = engine.evaluate_payment_risk(user_id, failed_count)
    if event:
        # In production, publish to Kafka: dm.security.fraud_alert
        return {"action": "BLOCK", "event": event}
    return {"action": "ALLOW"}

@app.post("/v1/internal/analyze/travel")
async def analyze_travel(payload: dict):
    event = engine.evaluate_travel_risk(
        user_id=payload.get("user_id"),
        last_country=payload.get("last_country"),
        current_country=payload.get("current_country"),
        time_diff_minutes=payload.get("time_diff_minutes")
    )
    if event:
        return {"action": "FLAG", "event": event}
    return {"action": "ALLOW"}
