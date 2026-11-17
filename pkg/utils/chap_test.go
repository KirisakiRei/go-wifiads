package utils

import (
	"crypto/md5" //nolint:gosec // Test fixture mirrors the RFC 2865 algorithm.
	"testing"
)

func TestVerifyCHAPMatchesMD5Digest(t *testing.T) {
	password := []byte("voucher-pass-123")
	challenge := []byte("chap-challenge-bytes")
	chapID := byte(7)

	digest := md5.New() //nolint:gosec // Required by RADIUS CHAP.
	digest.Write([]byte{chapID})
	digest.Write(password)
	digest.Write(challenge)
	chapPassword := append([]byte{chapID}, digest.Sum(nil)...)

	if !VerifyCHAP(chapPassword, password, challenge) {
		t.Fatal("expected CHAP verification to succeed")
	}
	if VerifyCHAP(chapPassword, []byte("wrong-password"), challenge) {
		t.Fatal("expected CHAP verification to fail for a wrong password")
	}
	if VerifyCHAP(chapPassword[:16], password, challenge) {
		t.Fatal("expected malformed CHAP-Password to be rejected")
	}
}

func TestNormalizeMACSameValue(t *testing.T) {
	cases := [][2]string{
		{"AA:BB:CC:DD:EE:FF", "aa:bb:cc:dd:ee:ff"},
		{"AA-BB-CC-DD-EE-FF", "aabbccddeeff"},
		{"aa:bb:cc:dd:ee:ff", "AABBCCDDEEFF"},
	}
	for _, pair := range cases {
		if NormalizeMAC(pair[0]) != NormalizeMAC(pair[1]) {
			t.Fatalf("expected %s and %s to normalize equally", pair[0], pair[1])
		}
	}
}
