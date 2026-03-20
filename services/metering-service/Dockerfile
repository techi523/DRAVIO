FROM golang:1.22-alpine

WORKDIR /app
ENV GOPROXY=direct

COPY go.mod ./
RUN go mod download

COPY . .

RUN go build -o metering ./cmd/main.go

CMD ["./metering"]
