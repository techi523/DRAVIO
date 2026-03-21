FROM python:3.11-slim

WORKDIR /app
COPY services/isp-service/requirements.txt ./
RUN pip install --no-cache-dir -r requirements.txt
RUN pip install --no-cache-dir Faker==24.4.0
COPY services/isp-service/. .

CMD ["python", "-m", "uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8080"]
