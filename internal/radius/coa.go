package radius

import (
	"context"
	"errors"
	"fmt"
	"net"
	"strings"
	"time"

	"layeh.com/radius"
	"layeh.com/radius/rfc2865"
	"layeh.com/radius/rfc2866"
)

const (
	defaultCoAPort    = "3799"
	defaultCoATimeout = 3 * time.Second
)

// DisconnectSession sends a RFC 5176 RADIUS Disconnect-Request (PoD) to a
// MikroTik NAS on UDP port 3799 (or the port specified in nasAddr).
func DisconnectSession(
	ctx context.Context,
	nasAddr string,
	secret string,
	acctSessionID string,
	username string,
	framedIP string,
	callingStationID string,
) error {
	host := strings.TrimSpace(nasAddr)
	if host == "" {
		return errors.New("nas IP address is empty")
	}
	if secret == "" {
		return errors.New("nas shared secret is empty")
	}
	if !strings.Contains(host, ":") {
		host = net.JoinHostPort(host, defaultCoAPort)
	}

	pkt := radius.New(radius.CodeDisconnectRequest, []byte(secret))
	if u := strings.TrimSpace(username); u != "" {
		_ = rfc2865.UserName_SetString(pkt, u)
	}
	if sid := strings.TrimSpace(acctSessionID); sid != "" {
		_ = rfc2866.AcctSessionID_SetString(pkt, sid)
	}
	if ip := net.ParseIP(strings.TrimSpace(framedIP)); ip != nil {
		_ = rfc2865.FramedIPAddress_Set(pkt, ip)
	}
	if mac := strings.TrimSpace(callingStationID); mac != "" {
		_ = rfc2865.CallingStationID_SetString(pkt, mac)
	}

	reqCtx, cancel := context.WithTimeout(ctx, defaultCoATimeout)
	defer cancel()

	client := &radius.Client{Retry: 0}
	resp, err := client.Exchange(reqCtx, pkt, host)
	if err != nil {
		return fmt.Errorf("coa disconnect exchange (%s): %w", host, err)
	}
	if resp.Code != radius.CodeDisconnectACK {
		return fmt.Errorf("nas rejected disconnect request with code %v", resp.Code)
	}
	return nil
}
