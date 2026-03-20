FROM golang:1.22-alpine AS builder
WORKDIR /app
ENV GOPROXY=direct
COPY go.mod ./
RUN go mod download
COPY . .
RUN go build -o main cmd/main.go

FROM alpine:latest
WORKDIR /root/
COPY --from=builder /app/main .
EXPOSE 3005
CMD ["./main"]
