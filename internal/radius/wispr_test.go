package radius

import (
	"testing"

	"layeh.com/radius"
)

func countVSA(pkt *radius.Packet) int {
	n := 0
	for _, avp := range pkt.Attributes {
		if avp.Type == 26 {
			n++
		}
	}
	return n
}

func TestAddMikroTikQuota(t *testing.T) {
	pktSmall := radius.New(radius.CodeAccessAccept, []byte("secret"))
	addMikroTikQuota(pktSmall, 500*1024*1024) // 500 MiB -> only type 17
	if got := countVSA(pktSmall); got != 1 {
		t.Fatalf("expected 1 VSA for 500MiB quota, got %d", got)
	}

	pktLarge := radius.New(radius.CodeAccessAccept, []byte("secret"))
	addMikroTikQuota(pktLarge, 5*1024*1024*1024) // 5 GiB -> type 17 + type 18 (gigawords)
	if got := countVSA(pktLarge); got != 2 {
		t.Fatalf("expected 2 VSAs (low + gigawords) for 5GiB quota, got %d", got)
	}

	pktUnlimited := radius.New(radius.CodeAccessAccept, []byte("secret"))
	addMikroTikQuota(pktUnlimited, 0)
	if got := countVSA(pktUnlimited); got != 0 {
		t.Fatalf("expected 0 VSAs for unlimited quota, got %d", got)
	}
}
