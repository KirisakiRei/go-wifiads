package radius

import (
	"crypto/sha256"
	"encoding/hex"
	"fmt"
	"log/slog"

	"layeh.com/radius"
	"layeh.com/radius/rfc2865"

	"wifiads/internal/service"
)

// handleAuth answers Access-Request packets.
func (s *Server) handleAuth(w radius.ResponseWriter, r *radius.Request) {
	request := authRequestFromPacket(r)

	result, err := s.auth.Authenticate(r.Context(), request)
	if err != nil {
		s.logger.Error("radius authentication failed",
			slog.String("username", request.Username),
			slog.String("error", err.Error()),
		)
		_ = w.Write(r.Response(radius.CodeAccessReject))
		return
	}

	if !result.Accepted {
		s.logger.Info("radius access rejected",
			slog.String("username", request.Username),
			slog.String("reason", result.Reason),
			slog.String("nas", request.NASIdentifier),
		)
		_ = w.Write(r.Response(radius.CodeAccessReject))
		return
	}

	response := r.Response(radius.CodeAccessAccept)
	_ = rfc2865.SessionTimeout_Add(response, rfc2865.SessionTimeout(result.SessionTimeoutSeconds))
	portLimit := result.SharedUsers
	if portLimit <= 0 {
		portLimit = 1
	}
	_ = rfc2865.PortLimit_Add(response, rfc2865.PortLimit(portLimit))
	addWISPrBandwidth(response, result.BandwidthUpKbps, result.BandwidthDownKbps)
	addMikroTikQuota(response, result.QuotaBytes)

	s.logger.Info("radius access accepted",
		slog.String("username", request.Username),
		slog.String("voucher_id", result.VoucherID),
		slog.String("nas", request.NASIdentifier),
	)
	_ = w.Write(response)
}

// handleAccounting answers Accounting-Request packets. The NAS always receives
// an Accounting-Response so it does not retry forever; failures are logged.
func (s *Server) handleAccounting(w radius.ResponseWriter, r *radius.Request) {
	request := accountingRequestFromPacket(r)
	request.EventKey = eventKey(r, request)
	request.Payload = fmt.Sprintf("status=%s user=%s nas=%s time=%d",
		request.StatusType, request.Username, request.NASIdentifier, request.SessionTimeSeconds)

	if err := s.accounting.Process(r.Context(), request); err != nil {
		s.logger.Error("radius accounting processing failed",
			slog.String("acct_session_id", request.AcctSessionID),
			slog.String("status_type", request.StatusType),
			slog.String("error", err.Error()),
		)
	}
	_ = w.Write(r.Response(radius.CodeAccountingResponse))
}

// eventKey deduplicates retransmitted accounting packets.
func eventKey(r *radius.Request, request service.RadiusAccountingRequest) string {
	raw := fmt.Sprintf("%s|%s|%s|%d|%d|%d",
		request.NASIdentifier,
		request.AcctSessionID,
		request.StatusType,
		request.SessionTimeSeconds,
		request.InputOctets,
		request.OutputOctets,
	)
	sum := sha256.Sum256([]byte(raw))
	return hex.EncodeToString(sum[:])
}
