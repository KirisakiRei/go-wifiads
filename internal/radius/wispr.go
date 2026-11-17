package radius

import (
	"layeh.com/radius"
)

// addWISPrBandwidth appends WISPr Vendor-Specific Attributes (VSA) for
// bandwidth shaping to the Access-Accept packet.
//
// WISPr VSA encoding (RFC 2865 §5.26):
//   - Vendor-Id  : 14122 (WISPr)
//   - Attr type 1: WISPr-Bandwidth-Max-Up   (uplink limit in bps)
//   - Attr type 2: WISPr-Bandwidth-Max-Down (downlink limit in bps)
//
// A value of 0 means "no limit configured" and the attribute is omitted so
// the NAS applies its own default profile.
func addWISPrBandwidth(response *radius.Packet, upKbps, downKbps int) {
	if upKbps > 0 {
		if attr, err := radius.NewVendorSpecific(14122, wispBandwidthValue(1, uint32(upKbps*1024))); err == nil {
			response.Attributes.Add(26, attr)
		}
	}
	if downKbps > 0 {
		if attr, err := radius.NewVendorSpecific(14122, wispBandwidthValue(2, uint32(downKbps*1024))); err == nil {
			response.Attributes.Add(26, attr)
		}
	}
}

// wispBandwidthValue encodes the VSA value portion for a WISPr bandwidth
// attribute: [type(1)] [length(1)] [value(4)] — total 6 bytes.
func wispBandwidthValue(attrType byte, valueBps uint32) []byte {
	return []byte{
		attrType,
		6, // length: type(1) + length(1) + value(4)
		byte(valueBps >> 24),
		byte(valueBps >> 16),
		byte(valueBps >> 8),
		byte(valueBps),
	}
}
