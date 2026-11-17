package utils

import (
	"crypto/rand"
	"crypto/sha256"
	"encoding/base64"
	"encoding/hex"
	"fmt"
	"math/big"
	"strings"
)

const (
	usernameAlphabet  = "abcdefghjkmnpqrstuvwxyz23456789"
	passwordAlphabet  = "abcdefghijkmnopqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ23456789"
	numericAlphabet   = "0123456789"
	alphanumericUpper = "23456789ABCDEFGHJKLMNPQRSTUVWXYZ"
)

// SecureToken returns a URL-safe random token built from n random bytes.
func SecureToken(n int) (string, error) {
	if n <= 0 {
		return "", fmt.Errorf("token size must be positive")
	}
	buf := make([]byte, n)
	if _, err := rand.Read(buf); err != nil {
		return "", fmt.Errorf("read random bytes: %w", err)
	}
	return base64.RawURLEncoding.EncodeToString(buf), nil
}

// HashToken derives the stored representation of a bearer-style token.
func HashToken(token string) string {
	sum := sha256.Sum256([]byte(token))
	return hex.EncodeToString(sum[:])
}

// GenerateVoucherUsername builds a unique, hard-to-guess Hotspot username.
func GenerateVoucherUsername(prefix string) (string, error) {
	suffix, err := randomString(usernameAlphabet, 10)
	if err != nil {
		return "", err
	}
	return prefix + suffix, nil
}

// GenerateCustomVoucherUsername generates a voucher username with prefix, specific length, and charset.
func GenerateCustomVoucherUsername(prefix string, length int, numericOnly bool) (string, error) {
	if length <= 0 {
		length = 6
	}
	alphabet := alphanumericUpper
	if numericOnly {
		alphabet = numericAlphabet
	}
	suffix, err := randomString(alphabet, length)
	if err != nil {
		return "", err
	}
	return prefix + suffix, nil
}

// GenerateVoucherPassword builds a random voucher password.
func GenerateVoucherPassword(length int) (string, error) {
	if length < 8 {
		length = 8
	}
	return randomString(passwordAlphabet, length)
}

func randomString(alphabet string, length int) (string, error) {
	if alphabet == "" || length <= 0 {
		return "", fmt.Errorf("invalid random string parameters")
	}
	var b strings.Builder
	b.Grow(length)
	max := big.NewInt(int64(len(alphabet)))
	for i := 0; i < length; i++ {
		idx, err := rand.Int(rand.Reader, max)
		if err != nil {
			return "", fmt.Errorf("read random index: %w", err)
		}
		b.WriteByte(alphabet[idx.Int64()])
	}
	return b.String(), nil
}
