package utils

import (
	"crypto/subtle"
	"golang.org/x/crypto/bcrypt"
)

// HashPassword hashes a human password with bcrypt. Only used for admin
// accounts: voucher and RADIUS secrets must stay recoverable for CHAP.
func HashPassword(password string) (string, error) {
	hashed, err := bcrypt.GenerateFromPassword([]byte(password), bcrypt.DefaultCost)
	if err != nil {
		return "", err
	}
	return string(hashed), nil
}

// CheckPasswordHash reports whether password matches the bcrypt hash.
func CheckPasswordHash(password, hash string) bool {
	return bcrypt.CompareHashAndPassword([]byte(hash), []byte(password)) == nil
}

// SecureCompare compares two strings in constant time.
func SecureCompare(a, b string) bool {
	return subtle.ConstantTimeCompare([]byte(a), []byte(b)) == 1
}
