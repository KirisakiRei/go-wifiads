package main

import (
	"context"
	"crypto/md5" //nolint:gosec // RADIUS CHAP is defined on MD5.
	"flag"
	"fmt"
	"os"
	"time"

	"layeh.com/radius"
	"layeh.com/radius/rfc2865"
	"layeh.com/radius/rfc2866"
)

// Test client for Phase 0: it behaves like a MikroTik Hotspot well enough to
// exercise Access-Request (PAP or CHAP) and Accounting without hardware.
func main() {
	mode := flag.String("mode", "auth", "auth | accounting")
	server := flag.String("server", "127.0.0.1:1812", "radius UDP address")
	secret := flag.String("secret", "testing123", "radshared secret")
	username := flag.String("user", "", "voucher username")
	password := flag.String("pass", "", "voucher password")
	chap := flag.Bool("chap", false, "use CHAP instead of PAP")
	mac := flag.String("mac", "AA:BB:CC:DD:EE:01", "calling station id")
	nasID := flag.String("nas", "alpha-router-01", "NAS-Identifier")
	acctSession := flag.String("session", "test-session-1", "Acct-Session-Id")
	status := flag.String("status", "Start", "Start | Interim-Update | Stop")
	seconds := flag.Int("seconds", 0, "acct session time")
	flag.Parse()

	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()

	if *mode == "accounting" {
		packet := radius.New(radius.CodeAccountingRequest, []byte(*secret))
		_ = rfc2865.UserName_SetString(packet, *username)
		_ = rfc2865.NASIdentifier_SetString(packet, *nasID)
		_ = rfc2865.CallingStationID_SetString(packet, *mac)
		_ = rfc2866.AcctSessionID_SetString(packet, *acctSession)
		_ = rfc2866.AcctStatusType_Set(packet, acctStatusType(*status))
		_ = rfc2866.AcctSessionTime_Set(packet, rfc2866.AcctSessionTime(*seconds))

		response, err := radius.Exchange(ctx, packet, *server)
		if err != nil {
			fmt.Fprintf(os.Stderr, "accounting request failed: %v\n", err)
			os.Exit(1)
		}
		fmt.Printf("accounting response: %s\n", response.Code)
		return
	}

	packet := radius.New(radius.CodeAccessRequest, []byte(*secret))
	_ = rfc2865.UserName_SetString(packet, *username)
	_ = rfc2865.NASIdentifier_SetString(packet, *nasID)
	_ = rfc2865.CallingStationID_SetString(packet, *mac)

	if *chap || *password == "" {
		challenge := []byte("0123456789abcdef")
		_ = rfc2865.CHAPChallenge_Set(packet, challenge)
		chapID := byte(1)
		response := chapResponse(chapID, *password, challenge)
		_ = rfc2865.CHAPPassword_Set(packet, append([]byte{chapID}, response...))
	} else {
		_ = rfc2865.UserPassword_SetString(packet, *password)
	}

	reply, err := radius.Exchange(ctx, packet, *server)
	if err != nil {
		fmt.Fprintf(os.Stderr, "access request failed: %v\n", err)
		os.Exit(1)
	}
	fmt.Printf("access response: %s\n", reply.Code)
}

func chapResponse(chapID byte, password string, challenge []byte) []byte {
	digest := md5.New() //nolint:gosec // Required by RADIUS CHAP.
	digest.Write([]byte{chapID})
	digest.Write([]byte(password))
	digest.Write(challenge)
	return digest.Sum(nil)
}

func acctStatusType(value string) rfc2866.AcctStatusType {
	switch value {
	case "Interim-Update":
		return rfc2866.AcctStatusType_Value_InterimUpdate
	case "Stop":
		return rfc2866.AcctStatusType_Value_Stop
	default:
		return rfc2866.AcctStatusType_Value_Start
	}
}
