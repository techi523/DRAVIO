FROM golang:1.22-alpine AS builder
WORKDIR /app
RUN apk add --no-cache git
COPY services/session-service/go.mod services/session-service/go.sum ./
RUN go mod download
COPY services/session-service/. .
RUN go build -o main cmd/main.go

FROM alpine:latest
WORKDIR /root/
COPY --from=builder /app/main .
EXPOSE 3005
CMD ["./main"]
