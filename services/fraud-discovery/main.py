from fastapi import FastAPI, BackgroundTasks
from engine.rules import FraudRuleEngine, SecurityEvent
from confluent_kafka import Consumer, KafkaError
import json
import asyncio
import os
import logging

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

app = FastAPI(title="DRAVIO Fraud Discovery Service")
engine = FraudRuleEngine()

async def kafka_consumer_loop():
    kafka_url = os.getenv("KAFKA_URL", "kafka:9092")
    conf = {
        'bootstrap.servers': kafka_url,
        'group.id': 'fraud-discovery-group',
        'auto.offset.reset': 'earliest'
    }
    
    consumer = Consumer(conf)
    consumer.subscribe(['dm.payment.completed', 'dm.auth.user_registered'])
    
    logger.info("Fraud Discovery Kafka Consumer started...")
    
    try:
        while True:
            msg = consumer.poll(1.0)
            if msg is None:
                await asyncio.sleep(0.1)
                continue
            if msg.error():
                if msg.error().code() == KafkaError._PARTITION_EOF:
                    continue
                else:
                    logger.error(f"Kafka error: {msg.error()}")
                    break
            
            try:
                topic = msg.topic()
                event = json.loads(msg.value().decode('utf-8'))
                logger.info(f"Analyzing event from {topic}")
                
                # Background analysis logic
                if topic == 'dm.payment.completed':
                    # Hypothetical: track velocity or large amounts
                    pass
                elif topic == 'dm.auth.user_registered':
                    logger.info(f"New user registered: {event.get('userId')}, performing initial risk scan.")
            
            except Exception as e:
                logger.error(f"Error processing fraud event: {e}")
            
            await asyncio.sleep(0)  # Yield to other tasks
    finally:
        consumer.close()

@app.on_event("startup")
async def startup_event():
    asyncio.create_task(kafka_consumer_loop())

@app.get("/health")
async def health():
    return {"status": "ok", "service": "fraud-discovery"}

@app.post("/v1/internal/analyze/payment")
async def analyze_payment(user_id: str, failed_count: int):
    event = engine.evaluate_payment_risk(user_id, failed_count)
    if event:
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
