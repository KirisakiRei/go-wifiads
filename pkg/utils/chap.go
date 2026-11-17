package utils

import (
	"crypto/md5" //nolint:gosec // RADIUS CHAP is defined on MD5 (RFC 2865 section 2.2).
	"crypto/subtle"
)

// ComputeCHAPResponse calculates the CHAP response for the given identifier,
// plaintext secret and challenge: MD5(chapID || secret || challenge).
func ComputeCHAPResponse(chapID byte, secret, challenge []byte) []byte {
	digest := md5.New() //nolint:gosec // Required by the RADIUS CHAP algorithm.
	digest.Write([]byte{chapID})
	digest.Write(secret)
	digest.Write(challenge)
	return digest.Sum(nil)
}

// VerifyCHAP compares a RADIUS CHAP-Password attribute against the expected
// response in constant time. CHAP-Password layout is [id][response(16)].
func VerifyCHAP(chapPassword, secret, challenge []byte) bool {
	if len(chapPassword) != 17 {
		return false
	}
	expected := ComputeCHAPResponse(chapPassword[0], secret, challenge)
	return subtle.ConstantTimeCompare(expected, chapPassword[1:]) == 1
}

// NormalizeMAC lowercases and strips separators so MACs reported by the portal
// and by RADIUS can be compared safely.
func NormalizeMAC(mac string) string {
	var b []byte
	for i := 0; i < len(mac); i++ {
		c := mac[i]
		switch {
		case c >= '0' && c <= '9':
			b = append(b, c)
		case c >= 'a' && c <= 'f':
			b = append(b, c)
		case c >= 'A' && c <= 'F':
			b = append(b, c+('a'-'A'))
		}
	}
	return string(b)
}
