package repository

import (
	"os"
	"path/filepath"
	"strings"
	"testing"

	"gorm.io/gorm/schema"
)

func TestGormIDRColumnNamingAndNoStaleSQLRefs(t *testing.T) {
	ns := schema.NamingStrategy{}
	if got := ns.ColumnName("", "WalletBalanceIDR"); got != "wallet_balance_id_r" {
		t.Fatalf("expected GORM ColumnName WalletBalanceIDR -> wallet_balance_id_r, got %q", got)
	}
	if got := ns.ColumnName("", "CostChargedIDR"); got != "cost_charged_id_r" {
		t.Fatalf("expected GORM ColumnName CostChargedIDR -> cost_charged_id_r, got %q", got)
	}

	entries, err := os.ReadDir(".")
	if err != nil {
		t.Fatalf("read repository dir: %v", err)
	}
	for _, entry := range entries {
		if entry.IsDir() || !strings.HasSuffix(entry.Name(), ".go") || strings.HasSuffix(entry.Name(), "_test.go") {
			continue
		}
		raw, err := os.ReadFile(filepath.Clean(entry.Name()))
		if err != nil {
			t.Fatalf("read %s: %v", entry.Name(), err)
		}
		if strings.Contains(string(raw), "_idr") {
			t.Errorf("%s contains stale _idr SQL/map reference; PostgreSQL columns use _id_r", entry.Name())
		}
	}
}
