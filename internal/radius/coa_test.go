package radius

import (
	"context"
	"net"
	"testing"

	"layeh.com/radius"
	"layeh.com/radius/rfc2865"
	"layeh.com/radius/rfc2866"
)

func TestDisconnectSessionACK(t *testing.T) {
	const secret = "test-coa-secret"

	pc, err := net.ListenPacket("udp", "127.0.0.1:0")
	if err != nil {
		t.Fatalf("listen udp: %v", err)
	}
	defer pc.Close()

	var gotUser, gotAcctID string
	srv := radius.PacketServer{
		SecretSource: radius.StaticSecretSource([]byte(secret)),
		Handler: radius.HandlerFunc(func(w radius.ResponseWriter, r *radius.Request) {
			gotUser = rfc2865.UserName_GetString(r.Packet)
			gotAcctID = rfc2866.AcctSessionID_GetString(r.Packet)
			_ = w.Write(r.Response(radius.CodeDisconnectACK))
		}),
	}
	go func() { _ = srv.Serve(pc) }()
	defer func() { _ = srv.Shutdown(context.Background()) }()

	err = DisconnectSession(
		context.Background(),
		pc.LocalAddr().String(),
		secret,
		"acct-123",
		"wf1234",
		"10.10.0.50",
		"AA:BB:CC:DD:EE:FF",
	)
	if err != nil {
		t.Fatalf("DisconnectSession returned error: %v", err)
	}
	if gotUser != "wf1234" || gotAcctID != "acct-123" {
		t.Fatalf("unexpected attributes: user=%q acct=%q", gotUser, gotAcctID)
	}
}
