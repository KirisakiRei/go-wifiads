package main

import (
	"context"
	"crypto/md5" //nolint:gosec // RADIUS CHAP is defined on MD5.
	"fmt"
	"time"

	"layeh.com/radius"
	"layeh.com/radius/rfc2865"
	"layeh.com/radius/rfc2866"
)

// verifyRadius proves the RADIUS leg without a MikroTik: PAP, CHAP, a wrong
// password, and accounting Start/Stop against the local RADIUS server.
func verifyRadius(username, password, mac, nasID string) {
	secret := []byte(getenv("SMOKE_RADIUS_SECRET", "testing123"))
	authAddr := getenv("SMOKE_RADIUS_ADDR", "127.0.0.1:1812")
	acctAddr := getenv("SMOKE_RADIUS_ACCT_ADDR", "127.0.0.1:1813")

	pap := radius.New(radius.CodeAccessRequest, secret)
	_ = rfc2865.UserName_SetString(pap, username)
	_ = rfc2865.UserPassword_SetString(pap, password)
	_ = rfc2865.NASIdentifier_SetString(pap, nasID)
	_ = rfc2865.CallingStationID_SetString(pap, mac)
	fmt.Printf("radius PAP: %s\n", exchange(authAddr, pap))

	challenge := []byte("0123456789abcdef")
	chapID := byte(3)
	digest := md5.New() //nolint:gosec // Required by RADIUS CHAP.
	digest.Write([]byte{chapID})
	digest.Write([]byte(password))
	digest.Write(challenge)

	chap := radius.New(radius.CodeAccessRequest, secret)
	_ = rfc2865.UserName_SetString(chap, username)
	_ = rfc2865.NASIdentifier_SetString(chap, nasID)
	_ = rfc2865.CallingStationID_SetString(chap, mac)
	_ = rfc2865.CHAPChallenge_Set(chap, challenge)
	_ = rfc2865.CHAPPassword_Set(chap, append([]byte{chapID}, digest.Sum(nil)...))
	fmt.Printf("radius CHAP: %s\n", exchange(authAddr, chap))

	bad := radius.New(radius.CodeAccessRequest, secret)
	_ = rfc2865.UserName_SetString(bad, username)
	_ = rfc2865.UserPassword_SetString(bad, password+"-wrong")
	_ = rfc2865.NASIdentifier_SetString(bad, nasID)
	_ = rfc2865.CallingStationID_SetString(bad, mac)
	fmt.Printf("radius wrong password: %s\n", exchange(authAddr, bad))

	sessionID := "smoke-" + username
	for _, status := range []string{"Start", "Stop"} {
		packet := radius.New(radius.CodeAccountingRequest, secret)
		_ = rfc2865.UserName_SetString(packet, username)
		_ = rfc2865.NASIdentifier_SetString(packet, nasID)
		_ = rfc2865.CallingStationID_SetString(packet, mac)
		_ = rfc2866.AcctSessionID_SetString(packet, sessionID)
		_ = rfc2866.AcctStatusType_Set(packet, statusOf(status))
		_ = rfc2866.AcctSessionTime_Set(packet, rfc2866.AcctSessionTime(42))
		fmt.Printf("accounting %s: %s\n", status, exchange(acctAddr, packet))
	}
}

func exchange(addr string, packet *radius.Packet) string {
	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()
	reply, err := radius.Exchange(ctx, packet, addr)
	if err != nil {
		die("radius exchange with " + addr + ": " + err.Error())
	}
	return reply.Code.String()
}

func statusOf(value string) rfc2866.AcctStatusType {
	if value == "Stop" {
		return rfc2866.AcctStatusType_Value_Stop
	}
	return rfc2866.AcctStatusType_Value_Start
}
