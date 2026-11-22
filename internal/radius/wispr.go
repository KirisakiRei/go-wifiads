package radius

import (
	"fmt"

	"layeh.com/radius"
)

const (
	vendorIDWISPr    = 14122
	vendorIDMikroTik = 14988

	// WISPr official dictionary attribute types (Vendor 14122):
	// 7 = WISPr-Bandwidth-Max-Up (integer, bps)
	// 8 = WISPr-Bandwidth-Max-Down (integer, bps)
	wisprAttrBandwidthMaxUp   = 7
	wisprAttrBandwidthMaxDown = 8

	// MikroTik official dictionary attribute types (Vendor 14988):
	// 8  = Mikrotik-Rate-Limit (string, "<rx-rate>/<tx-rate>" e.g. "512k/1024k")
	// 17 = Mikrotik-Total-Limit (integer, lower 32 bits of total bytes limit)
	// 18 = Mikrotik-Total-Limit-Gigawords (integer, upper 32 bits of total bytes limit)
	mikrotikAttrRateLimit           = 8
	mikrotikAttrTotalLimit          = 17
	mikrotikAttrTotalLimitGigawords = 18
)

// addWISPrBandwidth appends both MikroTik-Rate-Limit (Vendor 14988, Attr 8)
// and WISPr Vendor-Specific Attributes (Vendor 14122, Attr 7 & 8) for
// bandwidth shaping to the Access-Accept packet.
//
// A value of 0 means "no limit configured" and the attribute is omitted so
// the NAS applies its own default profile.
func addWISPrBandwidth(response *radius.Packet, upKbps, downKbps int) {
	if upKbps <= 0 && downKbps <= 0 {
		return
	}

	// 1. Native Mikrotik-Rate-Limit: "<rx-rate (upload)>/<tx-rate (download)>"
	upStr := "0"
	if upKbps > 0 {
		upStr = fmt.Sprintf("%dk", upKbps)
	}
	downStr := "0"
	if downKbps > 0 {
		downStr = fmt.Sprintf("%dk", downKbps)
	}
	rateLimit := fmt.Sprintf("%s/%s", upStr, downStr)
	if attr, err := radius.NewVendorSpecific(vendorIDMikroTik, vsaStringValue(mikrotikAttrRateLimit, rateLimit)); err == nil {
		response.Attributes.Add(26, attr)
	}

	// 2. Standard WISPr-Bandwidth-Max-Up (7) & WISPr-Bandwidth-Max-Down (8) in bps
	if upKbps > 0 {
		if attr, err := radius.NewVendorSpecific(vendorIDWISPr, wispBandwidthValue(wisprAttrBandwidthMaxUp, uint32(upKbps*1000))); err == nil {
			response.Attributes.Add(26, attr)
		}
	}
	if downKbps > 0 {
		if attr, err := radius.NewVendorSpecific(vendorIDWISPr, wispBandwidthValue(wisprAttrBandwidthMaxDown, uint32(downKbps*1000))); err == nil {
			response.Attributes.Add(26, attr)
		}
	}
}

// addMikroTikQuota appends Mikrotik-Total-Limit (Vendor 14988, type 17) and
// Mikrotik-Total-Limit-Gigawords (type 18, when >= 4 GiB) when quotaBytes > 0.
func addMikroTikQuota(response *radius.Packet, quotaBytes int64) {
	if quotaBytes <= 0 {
		return
	}
	u := uint64(quotaBytes)
	low := uint32(u & 0xFFFFFFFF)
	high := uint32(u >> 32)
	if attr, err := radius.NewVendorSpecific(vendorIDMikroTik, wispBandwidthValue(mikrotikAttrTotalLimit, low)); err == nil {
		response.Attributes.Add(26, attr)
	}
	if high > 0 {
		if attr, err := radius.NewVendorSpecific(vendorIDMikroTik, wispBandwidthValue(mikrotikAttrTotalLimitGigawords, high)); err == nil {
			response.Attributes.Add(26, attr)
		}
	}
}

// vsaStringValue encodes a string Vendor-Specific Attribute: [type(1)] [length(1)] [string...]
func vsaStringValue(attrType byte, value string) []byte {
	raw := []byte(value)
	out := make([]byte, 2+len(raw))
	out[0] = attrType
	out[1] = byte(2 + len(raw))
	copy(out[2:], raw)
	return out
}

// wispBandwidthValue encodes the VSA value portion for a 32-bit integer attribute:
// [type(1)] [length(1)] [value(4)] — total 6 bytes.
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
