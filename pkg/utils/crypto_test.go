package utils

import "testing"

func TestEncryptDecryptRoundTrip(t *testing.T) {
	key := DeriveDevKey("unit-test")
	cipher, err := EncryptString(key, "secret-voucher-password")
	if err != nil {
		t.Fatalf("encrypt: %v", err)
	}
	if cipher == "" || cipher == "secret-voucher-password" {
		t.Fatal("ciphertext must not be empty or plaintext")
	}

	plain, err := DecryptString(key, cipher)
	if err != nil {
		t.Fatalf("decrypt: %v", err)
	}
	if plain != "secret-voucher-password" {
		t.Fatalf("unexpected plaintext: %q", plain)
	}
}

func TestDecryptWithWrongKeyFails(t *testing.T) {
	cipher, err := EncryptString(DeriveDevKey("key-a"), "payload")
	if err != nil {
		t.Fatalf("encrypt: %v", err)
	}
	if _, err := DecryptString(DeriveDevKey("key-b"), cipher); err == nil {
		t.Fatal("expected decryption with a different key to fail")
	}
}

func TestParseKeyRejectsShortValue(t *testing.T) {
	if _, err := ParseKey("too-short"); err == nil {
		t.Fatal("expected short key to be rejected")
	}
}
