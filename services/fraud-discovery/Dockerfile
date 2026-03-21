FROM python:3.11-slim

WORKDIR /app
COPY services/fraud-discovery/requirements.txt ./
RUN pip install --no-cache-dir -r requirements.txt
COPY services/fraud-discovery/. .

CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8081"]
