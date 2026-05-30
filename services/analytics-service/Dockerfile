FROM python:3.11-slim

WORKDIR /app

# Install system dependencies for psycopg2
RUN apt-get update && apt-get install -y \
    libpq-dev \
    gcc \
    && rm -rf /var/lib/apt/lists/*

COPY services/analytics-service/requirements.txt ./
RUN pip install --default-timeout=1000 --no-cache-dir -r requirements.txt

COPY services/analytics-service/. .

CMD ["python", "aggregator.py"]
