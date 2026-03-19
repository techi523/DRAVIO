package main

import (
	"context"
	"log"
	"os"
	"os/signal"
	"syscall"

	"github.com/dravio/metering-service/internal/checker"
	"github.com/dravio/metering-service/internal/processor"
	"github.com/redis/go-redis/v9"
	"github.com/segmentio/kafka-go"
)

func main() {
	log.Println("Starting DRAVIO Metering Service...")

	redisClient := redis.NewClient(&redis.Options{
		Addr: os.Getenv("REDIS_URL"),
	})

	aggregator := &processor.UsageAggregator{RedisClient: redisClient}
	_ = &checker.ThresholdMonitor{RedisClient: redisClient}

	kafkaReader := kafka.NewReader(kafka.ReaderConfig{
		Brokers: []string{os.Getenv("KAFKA_URL")},
		Topic:   "dm.usage.ticks",
		GroupID: "metering-processor",
	})

	ctx, stop := signal.NotifyContext(context.Background(), os.Interrupt, syscall.SIGTERM)
	defer stop()

	log.Println("Consuming usage ticks...")

	go func() {
		for {
			m, err := kafkaReader.ReadMessage(ctx)
			if err != nil {
				break
			}
			aggregator.ProcessTick(ctx, m.Value)
		}
	}()

	<-ctx.Done()
	log.Println("Shutting down metering service...")
	kafkaReader.Close()
}
