package radius

import (
	"net"
	"strings"

	"layeh.com/radius"
	"layeh.com/radius/rfc2865"
	"layeh.com/radius/rfc2866"

	"wifiads/internal/service"
)

// authRequestFromPacket normalizes an Access-Request for the service layer.
func authRequestFromPacket(r *radius.Request) service.RadiusAuthRequest {
	request := service.RadiusAuthRequest{
		RemoteIP:         r.RemoteAddr.String(),
		NASIdentifier:    strings.TrimSpace(rfc2865.NASIdentifier_GetString(r.Packet)),
		NASIPAddress:     ipString(rfc2865.NASIPAddress_Get(r.Packet)),
		Username:         strings.TrimSpace(rfc2865.UserName_GetString(r.Packet)),
		Password:         rfc2865.UserPassword_GetString(r.Packet),
		CallingStationID: rfc2865.CallingStationID_GetString(r.Packet),
		FramedIPAddress:  ipString(rfc2865.FramedIPAddress_Get(r.Packet)),
	}

	if chapPassword := rfc2865.CHAPPassword_Get(r.Packet); len(chapPassword) > 0 {
		request.HasCHAP = true
		request.CHAPPassword = chapPassword
		request.CHAPChallenge = rfc2865.CHAPChallenge_Get(r.Packet)
		authenticator := r.Authenticator
		request.RequestAuthenticator = authenticator[:]
	}
	return request
}

// accountingRequestFromPacket normalizes an Accounting-Request.
func accountingRequestFromPacket(r *radius.Request) service.RadiusAccountingRequest {
	return service.RadiusAccountingRequest{
		RemoteIP:           r.RemoteAddr.String(),
		NASIdentifier:      strings.TrimSpace(rfc2865.NASIdentifier_GetString(r.Packet)),
		AcctSessionID:      strings.TrimSpace(rfc2866.AcctSessionID_GetString(r.Packet)),
		StatusType:         rfc2866.AcctStatusType_Get(r.Packet).String(),
		Username:           strings.TrimSpace(rfc2865.UserName_GetString(r.Packet)),
		CallingStationID:   rfc2865.CallingStationID_GetString(r.Packet),
		FramedIPAddress:    ipString(rfc2865.FramedIPAddress_Get(r.Packet)),
		SessionTimeSeconds: int64(rfc2866.AcctSessionTime_Get(r.Packet)),
		InputOctets:        int64(rfc2866.AcctInputOctets_Get(r.Packet)),
		OutputOctets:       int64(rfc2866.AcctOutputOctets_Get(r.Packet)),
		TerminateCause:     rfc2866.AcctTerminateCause_Get(r.Packet).String(),
	}
}

func ipString(ip net.IP) string {
	if ip == nil {
		return ""
	}
	if v4 := ip.To4(); v4 != nil {
		return v4.String()
	}
	return ip.String()
}
