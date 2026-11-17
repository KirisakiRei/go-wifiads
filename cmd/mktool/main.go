// cmd/mktool — MikroTik SSH automation tool.
// Usage:
//
//	go run ./cmd/mktool -mode inspect
//	go run ./cmd/mktool -mode apply
package main

import (
	"flag"
	"fmt"
	"log"
	"net"
	"strings"
	"time"

	"golang.org/x/crypto/ssh"
)

const (
	defaultHost  = "192.168.88.1"
	defaultPort  = "22"
	defaultUser  = "admin"
	defaultPass  = ""
	portalIP     = "192.168.88.2"
	radiusSecret = "testing123"
	hotspotIface = "ether3-slave-local"
	hotspotGW    = "10.10.0.1"
	hotspotNet   = "10.10.0.0/24"
	hotspotPool  = "10.10.0.10-10.10.0.254"
	wanIface     = "ether1-gateway"
)

func main() {
	host := flag.String("host", defaultHost, "MikroTik IP")
	port := flag.String("port", defaultPort, "SSH port")
	user := flag.String("user", defaultUser, "SSH username")
	pass := flag.String("pass", defaultPass, "SSH password")
	mode := flag.String("mode", "inspect", "inspect | apply")
	flag.Parse()

	addr := net.JoinHostPort(*host, *port)
	client, err := sshConnect(addr, *user, *pass)
	if err != nil {
		log.Fatalf("SSH connect failed: %v", err)
	}
	defer client.Close()
	fmt.Printf("✓ Terhubung ke MikroTik %s\n\n", addr)

	switch *mode {
	case "inspect":
		inspect(client)
	case "apply":
		apply(client)
	case "pingtest":
		section("Ping dari MikroTik ke PC (192.168.88.2)")
		out := run(client, `/ping 192.168.88.2 count=3`)
		fmt.Println(out)
		section("Hotspot active users")
		out = run(client, `/ip hotspot active print`)
		if out == "" {
			fmt.Println("  (tidak ada user aktif)")
		} else {
			fmt.Println(out)
		}
		section("Hotspot host")
		out = run(client, `/ip hotspot host print`)
		if out == "" {
			fmt.Println("  (tidak ada host)")
		} else {
			fmt.Println(out)
		}

	case "fixprofile":
		section("Fix: set hotspot instance ke wifiads-profile")
		out := run(client, `/ip hotspot set [find name=wifiads-hs] profile=wifiads-profile`)
		if out != "" {
			fmt.Println(" " + out)
		}
		out = run(client, `/ip hotspot print`)
		fmt.Println(out)

		section("Fix: NAT masquerade wifiads-masq")
		out = run(client, `:foreach i in=[/ip firewall nat find comment=wifiads-masq] do={ /ip firewall nat remove $i }`)
		if out != "" {
			fmt.Println(" " + out)
		}
		out = run(client, `/ip firewall nat add chain=srcnat out-interface=ether1-gateway action=masquerade comment=wifiads-masq`)
		if out != "" {
			fmt.Println(" " + out)
		}
		out = run(client, `/ip firewall nat print`)
		fmt.Println(out)

		section("Fix: walled garden IP — pastikan aktif")
		out = run(client, `:foreach i in=[/ip hotspot walled-garden ip find comment~"wifiads"] do={ /ip hotspot walled-garden ip remove $i }`)
		if out != "" {
			fmt.Println(" " + out)
		}
		out = run(client, `/ip hotspot walled-garden ip add dst-address=192.168.88.2/32 action=accept comment=wifiads-portal-ip`)
		if out != "" {
			fmt.Println(" " + out)
		}
		out = run(client, `/ip hotspot walled-garden ip print`)
		fmt.Println(out)

		section("Verifikasi RADIUS")
		out = run(client, `/radius print`)
		fmt.Println(out)
		out = run(client, `/ip hotspot profile print`)
		fmt.Println(out)

		fmt.Println("\n✓ Fix selesai.")

	case "setpap":
		section("Switch hotspot profile login-by ke http-pap only")
		out := run(client, `/ip hotspot profile set [find name=wifiads-profile] login-by=http-pap`)
		if out != "" {
			fmt.Println(" " + out)
		}
		out = run(client, `/ip hotspot profile print`)
		fmt.Println(out)
		fmt.Println("\n✓ Selesai. Hotspot sekarang PAP only.")

	case "setchap":
		section("Switch hotspot profile login-by ke http-pap,http-chap")
		out := run(client, `/ip hotspot profile set [find name=wifiads-profile] login-by=http-pap,http-chap`)
		if out != "" {
			fmt.Println(" " + out)
		}
		out = run(client, `/ip hotspot profile print`)
		fmt.Println(out)
		fmt.Println("\n✓ Selesai. Hotspot sekarang PAP+CHAP.")

	case "movefile":
		// RouterOS 5.x: set nama file by number index
		out := run(client, `/file set 6 name=hotspot/login.html`)
		if out != "" {
			fmt.Println(out)
		}
		out2 := run(client, `/file print`)
		fmt.Println(out2)
	default:
		log.Fatalf("mode tidak dikenal: %s (inspect | apply | movefile)", *mode)
	}
}

// ── SSH helpers ───────────────────────────────────────────────────────────────

func sshConnect(addr, user, pass string) (*ssh.Client, error) {
	cfg := &ssh.ClientConfig{
		User: user,
		Auth: []ssh.AuthMethod{ssh.Password(pass)},
		// RouterOS 5.x hanya support cipher CBC lama.
		Config:          ssh.Config{Ciphers: []string{"aes128-cbc", "aes192-cbc", "aes256-cbc", "3des-cbc", "blowfish-cbc"}},
		HostKeyCallback: ssh.InsecureIgnoreHostKey(), //nolint:gosec // internal LAN tool only
		Timeout:         10 * time.Second,
	}
	return ssh.Dial("tcp", addr, cfg)
}

func run(c *ssh.Client, cmd string) string {
	sess, err := c.NewSession()
	if err != nil {
		return fmt.Sprintf("[session error: %v]", err)
	}
	defer sess.Close()
	var buf strings.Builder
	sess.Stdout = &buf
	sess.Stderr = &buf
	_ = sess.Run(cmd)
	return strings.TrimSpace(buf.String())
}

func section(title string) {
	pad := 56 - len(title)
	if pad < 0 {
		pad = 0
	}
	fmt.Printf("\n━━━ %s %s\n", title, strings.Repeat("━", pad))
}

func step(c *ssh.Client, label string, cmds []string) {
	section(label)
	for _, cmd := range cmds {
		out := run(c, cmd)
		if out != "" {
			for _, line := range strings.Split(out, "\n") {
				fmt.Println("  " + line)
			}
		}
	}
	fmt.Println("  ✓ done")
}

// ── inspect ───────────────────────────────────────────────────────────────────

func inspect(c *ssh.Client) {
	fmt.Println("MODE: inspect")
	items := []struct{ label, cmd string }{
		{"System identity", "/system identity print"},
		{"RouterOS version", "/system resource print"},
		{"Interfaces", "/interface print"},
		{"IP Addresses", "/ip address print"},
		{"DHCP client", "/ip dhcp-client print"},
		{"DHCP server", "/ip dhcp-server print"},
		{"Hotspot", "/ip hotspot print"},
		{"Hotspot profiles", "/ip hotspot profile print"},
		{"RADIUS servers", "/radius print"},
		{"Walled garden", "/ip hotspot walled-garden print"},
		{"Walled garden IP", "/ip hotspot walled-garden ip print"},
		{"Firewall NAT", "/ip firewall nat print"},
		{"DNS", "/ip dns print"},
	}
	for _, it := range items {
		section(it.label)
		out := run(c, it.cmd)
		if out == "" {
			fmt.Println("  (kosong)")
		} else {
			for _, line := range strings.Split(out, "\n") {
				fmt.Println("  " + line)
			}
		}
	}
	fmt.Println("\n✓ Inspect selesai.")
}

// ── apply ─────────────────────────────────────────────────────────────────────

func apply(c *ssh.Client) {
	fmt.Println("MODE: apply — konfigurasi MikroTik RB750 RouterOS 5.9")
	fmt.Printf("  Topologi  : %s=WAN | ether2=LAN-PC(88.2) | %s=AP-Hotspot\n", wanIface, hotspotIface)
	fmt.Printf("  Hotspot   : %s — network %s\n", hotspotGW, hotspotNet)
	fmt.Printf("  Portal    : http://%s:8080\n", portalIP)
	fmt.Printf("  RADIUS    : %s:1812/1813  secret=%s\n\n", portalIP, radiusSecret)

	// 1. Identity
	step(c, "1. System identity", []string{
		"/system identity set name=WiFiAds-RB750",
	})

	// 2. Pisahkan ether3 dari bridge ether2-master-local
	// RB750 default: ether3-5 adalah slave ether2. Hotspot wajib interface standalone.
	step(c, "2. Pisahkan ether3 dari bridge", []string{
		"/interface ethernet set [find name=ether3-slave-local] master-port=none",
	})

	// 3. IP Address ether3
	step(c, "3. IP ether3 — hotspot gateway "+hotspotGW+"/24", []string{
		":foreach i in=[/ip address find interface=ether3-slave-local] do={ /ip address remove $i }",
		"/ip address add address=" + hotspotGW + "/24 interface=ether3-slave-local comment=wifiads-hotspot",
	})

	// 4. DHCP pool + server ether3
	step(c, "4. DHCP pool dan server ether3", []string{
		":foreach i in=[/ip pool find name=hotspot-pool] do={ /ip pool remove $i }",
		"/ip pool add name=hotspot-pool ranges=" + hotspotPool,
		":foreach i in=[/ip dhcp-server network find address=" + hotspotNet + "] do={ /ip dhcp-server network remove $i }",
		"/ip dhcp-server network add address=" + hotspotNet + " gateway=" + hotspotGW + " dns-server=" + hotspotGW,
		":foreach i in=[/ip dhcp-server find interface=ether3-slave-local] do={ /ip dhcp-server remove $i }",
		"/ip dhcp-server add name=hotspot-dhcp interface=ether3-slave-local address-pool=hotspot-pool disabled=no",
	})

	// 5. DNS
	step(c, "5. DNS", []string{
		"/ip dns set allow-remote-requests=yes servers=8.8.8.8,8.8.4.4",
	})

	// 6. NAT masquerade
	step(c, "6. NAT masquerade via "+wanIface, []string{
		":foreach i in=[/ip firewall nat find comment=wifiads-masq] do={ /ip firewall nat remove $i }",
		"/ip firewall nat add chain=srcnat out-interface=" + wanIface + " action=masquerade comment=wifiads-masq",
	})

	// 7. Hotspot profile
	step(c, "7. Hotspot profile — wifiads-profile", []string{
		":foreach i in=[/ip hotspot profile find name=wifiads-profile] do={ /ip hotspot profile remove $i }",
		"/ip hotspot profile add name=wifiads-profile" +
			" hotspot-address=" + hotspotGW +
			` dns-name=""` +
			" html-directory=hotspot" +
			" http-proxy=0.0.0.0:0" +
			" login-by=http-pap,http-chap" +
			" use-radius=yes" +
			" radius-accounting=yes" +
			" radius-interim-update=5m" +
			" radius-mac-format=XX:XX:XX:XX:XX:XX" +
			" nas-port-type=wireless-802.11",
	})

	// 8. Hotspot instance
	step(c, "8. Hotspot instance di ether3", []string{
		":foreach i in=[/ip hotspot find interface=ether3-slave-local] do={ /ip hotspot remove $i }",
		"/ip hotspot add name=wifiads-hs" +
			" interface=ether3-slave-local" +
			" address-pool=hotspot-pool" +
			" profile=wifiads-profile" +
			" disabled=no",
	})

	// 9. RADIUS
	step(c, "9. RADIUS server → "+portalIP, []string{
		`:foreach i in=[/radius find service~"hotspot"] do={ /radius remove $i }`,
		"/radius add service=hotspot" +
			" address=" + portalIP +
			` secret="` + radiusSecret + `"` +
			" authentication-port=1812 accounting-port=1813" +
			" timeout=3s comment=go-wifiads",
	})

	// 10. Login page redirect
	loginURL := "http://" + portalIP + ":8080/portal" +
		"?mac=$(mac)&ip=$(ip)" +
		"&link-login-only=$(link-login-only-esc)" +
		"&link-login=$(link-login-esc)" +
		"&link-orig=$(link-orig-esc)" +
		"&chap-id=$(chap-id)" +
		"&chap-challenge=$(chap-challenge)"
	loginHTML := `<html><head><meta http-equiv="refresh" content="0;url=` + loginURL + `"/></head><body>Redirecting to WiFi Portal...</body></html>`
	step(c, "10. Login page redirect ke external portal", []string{
		`:foreach i in=[/file find name="hotspot/login.html"] do={ /file remove $i }`,
		`:local c "` + loginHTML + `"`,
		`/file add name="hotspot/login.html" contents=$c`,
	})

	// 11. Walled garden
	step(c, "11. Walled garden — akses portal sebelum login", []string{
		`:foreach i in=[/ip hotspot walled-garden find comment~"wifiads"] do={ /ip hotspot walled-garden remove $i }`,
		"/ip hotspot walled-garden add dst-host=" + portalIP + " action=allow comment=wifiads-portal",
		`:foreach i in=[/ip hotspot walled-garden ip find comment~"wifiads"] do={ /ip hotspot walled-garden ip remove $i }`,
		"/ip hotspot walled-garden ip add dst-address=" + portalIP + "/32 action=accept comment=wifiads-portal-ip",
	})

	// 12. Verifikasi
	step(c, "12. Verifikasi hasil", []string{
		"/system identity print",
		"/ip address print",
		"/ip hotspot print",
		"/ip hotspot profile print",
		"/radius print",
		"/ip hotspot walled-garden ip print",
	})

	// Summary
	fmt.Println()
	fmt.Println("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━")
	fmt.Println("✓ Konfigurasi MikroTik selesai!")
	fmt.Println()
	fmt.Printf("  WAN  (internet)   : %s — DHCP\n", wanIface)
	fmt.Printf("  LAN  (PC admin)   : ether2  — 192.168.88.1/24\n")
	fmt.Printf("  WLAN (hotspot AP) : ether3  — %s/24\n", hotspotGW)
	fmt.Println()
	fmt.Printf("  Portal  : http://%s:8080/portal\n", portalIP)
	fmt.Printf("  Admin   : http://%s:8080/admin\n", portalIP)
	fmt.Println()
	fmt.Println("  Langkah selanjutnya di PC kamu:")
	fmt.Println("  1. go run ./cmd/migrate")
	fmt.Println("  2. go run ./cmd/server")
	fmt.Println("  3. go run ./cmd/radius")
	fmt.Println("  4. Sambungkan HP ke SSID AP → browser auto-redirect ke portal")
	fmt.Println()
	fmt.Println("  Pastikan .env punya:")
	fmt.Printf("    SEED_NAS_IP=10.10.0.1\n")
	fmt.Printf("    SEED_NAS_SHARED_SECRET=%s\n", radiusSecret)
}
