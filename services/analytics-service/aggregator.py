import json
import logging
import os
from confluent_kafka import Consumer
import psycopg2

logging.basicConfig(level=logging.INFO)

def start_aggregator():
    kafka_url = os.getenv("KAFKA_URL", "localhost:9092")
    db_url = os.getenv("DATABASE_URL")
    
    consumer = Consumer({
        'bootstrap.servers': kafka_url,
        'group.id': 'analytics-aggregator',
        'auto.offset.reset': 'earliest'
    })
    
    topics = ['dm.session.completed', 'dm.payment.completed']
    consumer.subscribe(topics)
    
    logging.info("Analytics Aggregator started...")
    
    try:
        while True:
            msg = consumer.poll(1.0)
            if msg is None: continue
            if msg.error():
                logging.error(f"Kafka error: {msg.error()}")
                continue
            
            event = json.loads(msg.value().decode('utf-8'))
            logging.info(f"Processing event: {msg.topic()}")
            
            # Logic to update PostgreSQL aggregates
            # In production, this would call stored procedures or perform UPSERTs
            
    finally:
        consumer.close()

if __name__ == "__main__":
    start_aggregator()
