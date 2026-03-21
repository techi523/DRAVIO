FROM golang:1.22-alpine

WORKDIR /app
RUN apk add --no-cache git

COPY services/metering-service/go.mod services/metering-service/go.sum ./
RUN go mod download

COPY services/metering-service/. .

RUN go build -o metering ./cmd/main.go

CMD ["./metering"]
