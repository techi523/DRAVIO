package checker

import (
	"context"
	"log"

	"github.com/redis/go-redis/v9"
)

type ThresholdMonitor struct {
	RedisClient *redis.Client
}

func (m *ThresholdMonitor) IsExhausted(ctx context.Context, sessionID string, quotaBytes int64) (bool, error) {
	key := "session:" + sessionID + ":usage"
	val, err := m.RedisClient.Get(ctx, key).Int64()
	if err == redis.Nil {
		return false, nil
	} else if err != nil {
		return false, err
	}

	if val >= quotaBytes {
		log.Printf("Session %s exhausted! Used %d / Quota %d", sessionID, val, quotaBytes)
		return true, nil
	}

	return false, nil
}
