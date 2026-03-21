import json
import logging
import os
import signal
import sys
from confluent_kafka import Consumer, KafkaError
import psycopg2
from psycopg2.extras import execute_values

logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(levelname)s - %(message)s')

def get_db_connection():
    db_url = os.getenv("DATABASE_URL", "postgres://dravio_user:dravio_password@postgres:5432/dravio_dev")
    return psycopg2.connect(db_url)

def update_metric(conn, name, value_delta):
    with conn.cursor() as cur:
        cur.execute("""
            INSERT INTO analytics.metrics (metric_name, metric_value, updated_at)
            VALUES (%s, %s, CURRENT_TIMESTAMP)
            ON CONFLICT (metric_name) DO UPDATE
            SET metric_value = analytics.metrics.metric_value + EXCLUDED.metric_value,
                updated_at = EXCLUDED.updated_at
        """, (name, value_delta))
    conn.commit()

def start_aggregator():
    kafka_url = os.getenv("KAFKA_URL", "kafka:9092")
    
    conf = {
        'bootstrap.servers': kafka_url,
        'group.id': 'analytics-aggregator',
        'auto.offset.reset': 'earliest',
        'enable.auto.commit': True
    }
    
    consumer = Consumer(conf)
    topics = ['dm.session.completed', 'dm.payment.completed']
    consumer.subscribe(topics)
    
    logging.info(f"Analytics Aggregator started. Subscribed to {topics}")
    
    conn = None
    try:
        conn = get_db_connection()
        while True:
            msg = consumer.poll(1.0)
            if msg is None: continue
            if msg.error():
                if msg.error().code() == KafkaError._PARTITION_EOF:
                    continue
                else:
                    logging.error(f"Kafka error: {msg.error()}")
                    break
            
            try:
                topic = msg.topic()
                event = json.loads(msg.value().decode('utf-8'))
                
                if topic == 'dm.session.completed':
                    logging.info("Incrementing total_sessions metric")
                    update_metric(conn, 'total_sessions', 1)
                elif topic == 'dm.payment.completed':
                    amount = event.get('amount', 0)
                    logging.info(f"Adding {amount} to total_revenue metric")
                    update_metric(conn, 'total_revenue', float(amount))
                
            except Exception as e:
                logging.error(f"Error processing event: {e}")
                
    except Exception as e:
        logging.error(f"Aggregator fatal error: {e}")
    finally:
        if conn: conn.close()
        consumer.close()

if __name__ == "__main__":
    start_aggregator()
