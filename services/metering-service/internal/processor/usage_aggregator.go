package processor

import (
	"context"
	"encoding/json"
	"log"

	"github.com/redis/go-redis/v9"
)

type UsageTick struct {
	SessionID   string  `json:"session_id"`
	BytesIn     int64   `json:"bytes_in"`
	BytesOut    int64   `json:"bytes_out"`
	Timestamp   string  `json:"timestamp"`
}

type UsageAggregator struct {
	RedisClient *redis.Client
}

func (a *UsageAggregator) ProcessTick(ctx context.Context, data []byte) error {
	var tick UsageTick
	if err := json.Unmarshal(data, &tick); err != nil {
		return err
	}

	totalBytes := tick.BytesIn + tick.BytesOut
	
	// Increment real-time counter in Redis
	key := "session:" + tick.SessionID + ":usage"
	err := a.RedisClient.IncrBy(ctx, key, totalBytes).Err()
	if err != nil {
		log.Printf("Failed to increment usage in Redis: %v", err)
		return err
	}

	return nil
}
