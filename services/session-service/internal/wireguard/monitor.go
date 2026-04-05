package wireguard

import (
	"bufio"
	"fmt"
	"os/exec"
	"strconv"
	"strings"
)

type PeerStats struct {
	PublicKey string
	RxBytes   int64
	TxBytes   int64
}

// GetStats returns the stats for all peers on the given interface
func GetStats(iface string) ([]PeerStats, error) {
	cmd := exec.Command("wg", "show", iface, "dump")
	output, err := cmd.Output()
	if err != nil {
		return nil, fmt.Errorf("failed to run wg show: %w", err)
	}

	var stats []PeerStats
	scanner := bufio.NewScanner(strings.NewReader(string(output)))
	// Skip the first line (interface info)
	if !scanner.Scan() {
		return nil, nil
	}

	for scanner.Scan() {
		line := scanner.Text()
		fields := strings.Fields(line)
		if len(fields) < 8 {
			continue
		}

		rx, _ := strconv.ParseInt(fields[5], 10, 64)
		tx, _ := strconv.ParseInt(fields[6], 10, 64)

		stats = append(stats, PeerStats{
			PublicKey: fields[0],
			RxBytes:   rx,
			TxBytes:   tx,
		})
	}

	return stats, nil
}
