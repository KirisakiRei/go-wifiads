package utils

import (
	"crypto/aes"
	"crypto/cipher"
	"crypto/rand"
	"crypto/sha256"
	"encoding/base64"
	"encoding/hex"
	"errors"
	"fmt"
	"io"
	"strings"
)

const (
	// KeySize is the AES-256 key length used for every reversible secret.
	KeySize = 32
)

var ErrInvalidCiphertext = errors.New("invalid ciphertext")

// ParseKey decodes a 32-byte key from hex, base64 (standard or URL-safe, padded
// or raw) or a raw 32-character string.
func ParseKey(raw string) ([]byte, error) {
	raw = strings.TrimSpace(raw)
	if raw == "" {
		return nil, errors.New("key is empty")
	}
	if decoded, err := hex.DecodeString(raw); err == nil && len(decoded) == KeySize {
		return decoded, nil
	}
	for _, encoding := range []*base64.Encoding{base64.StdEncoding, base64.RawStdEncoding, base64.URLEncoding, base64.RawURLEncoding} {
		if decoded, err := encoding.DecodeString(raw); err == nil && len(decoded) == KeySize {
			return decoded, nil
		}
	}
	if len(raw) == KeySize {
		return []byte(raw), nil
	}
	return nil, fmt.Errorf("key must decode to exactly %d bytes", KeySize)
}

// DeriveDevKey produces a deterministic key for local development only.
func DeriveDevKey(label string) []byte {
	sum := sha256.Sum256([]byte("wifiads-dev-key:" + label))
	return sum[:]
}

// EncryptString seals plaintext with AES-256-GCM and returns base64(nonce||ct).
// Secrets stored this way are recoverable by the RADIUS service, which is
// required to verify CHAP and to validate RADIUS packet digests.
func EncryptString(key []byte, plaintext string) (string, error) {
	gcm, err := newGCM(key)
	if err != nil {
		return "", err
	}
	nonce := make([]byte, gcm.NonceSize())
	if _, err := io.ReadFull(rand.Reader, nonce); err != nil {
		return "", fmt.Errorf("generate nonce: %w", err)
	}
	sealed := gcm.Seal(nonce, nonce, []byte(plaintext), nil)
	return base64.RawStdEncoding.EncodeToString(sealed), nil
}

// DecryptString opens a value produced by EncryptString.
func DecryptString(key []byte, encoded string) (string, error) {
	gcm, err := newGCM(key)
	if err != nil {
		return "", err
	}
	raw, err := base64.RawStdEncoding.DecodeString(strings.TrimSpace(encoded))
	if err != nil {
		return "", ErrInvalidCiphertext
	}
	nonceSize := gcm.NonceSize()
	if len(raw) < nonceSize {
		return "", ErrInvalidCiphertext
	}
	plaintext, err := gcm.Open(nil, raw[:nonceSize], raw[nonceSize:], nil)
	if err != nil {
		return "", ErrInvalidCiphertext
	}
	return string(plaintext), nil
}

func newGCM(key []byte) (cipher.AEAD, error) {
	if len(key) != KeySize {
		return nil, fmt.Errorf("aes key must be %d bytes, got %d", KeySize, len(key))
	}
	block, err := aes.NewCipher(key)
	if err != nil {
		return nil, err
	}
	return cipher.NewGCM(block)
}
