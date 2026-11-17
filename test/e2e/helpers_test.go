//go:build e2e

package e2e

import (
	"fmt"
	"io"
	"log/slog"
	"net"
	"testing"
	"time"

	"gorm.io/driver/postgres"
	"gorm.io/gorm"
	gormlogger "gorm.io/gorm/logger"

	"wifiads/internal/config"
)

// dropDatabase removes the isolated test database using the maintenance
// connection (mirrors config.EnsureDatabase).
func dropDatabase(cfg *config.Config) error {
	maintenance := cfg.DB
	maintenance.Name = "postgres"
	db, err := gorm.Open(postgres.Open(maintenance.DSN()), &gorm.Config{
		Logger: gormlogger.Default.LogMode(gormlogger.Silent),
	})
	if err != nil {
		return err
	}
	sqlDB, err := db.DB()
	if err != nil {
		return err
	}
	defer func() { _ = sqlDB.Close() }()
	return db.Exec(fmt.Sprintf("DROP DATABASE IF EXISTS %q WITH (FORCE)", cfg.DB.Name)).Error
}

// freeUDPAddr reserves and releases a UDP port, returning its address. The
// brief race window is acceptable for a local test server.
func freeUDPAddr(t *testing.T) string {
	t.Helper()
	conn, err := net.ListenPacket("udp", "127.0.0.1:0")
	if err != nil {
		t.Fatalf("reserve udp port: %v", err)
	}
	addr := conn.LocalAddr().String()
	_ = conn.Close()
	return addr
}

// waitForUDP waits until the RADIUS listener answers (or the timeout hits).
func waitForUDP(t *testing.T, addr string) {
	t.Helper()
	deadline := time.Now().Add(5 * time.Second)
	for time.Now().Before(deadline) {
		conn, err := net.Dial("udp", addr)
		if err == nil {
			_ = conn.Close()
			// Give the goroutine a moment to enter ListenAndServe.
			time.Sleep(50 * time.Millisecond)
			return
		}
		time.Sleep(50 * time.Millisecond)
	}
	t.Fatalf("radius listener %s did not come up", addr)
}

// silence is a helper for discarding logs in tests.
func silence() *slog.Logger {
	return slog.New(slog.NewTextHandler(io.Discard, nil))
}
