# =====================================================================
# WiFiAds Alpha 0.1 — MikroTik Hotspot & RADIUS Configuration Template
# =====================================================================
# Panduan pakai:
# 1. Buka file ini, ganti nilai variable serverIp di bawah dengan IP
#    laptop kau (cek via 'ipconfig' di CMD laptop, misal: 192.168.88.254).
# 2. Upload file ini ke MikroTik via Winbox (menu Files -> Drag & Drop).
# 3. Buka Terminal Winbox, ketik:
#    /import file-name=wifiads-setup.rsc
# =====================================================================

:local serverIp "192.168.88.254"
:local radiusSecret "testing123"

:put ("[*] Memasang konfigurasi WiFiAds untuk Server: " . $serverIp)

# 1. Bersihkan entri lama jika sebelumnya pernah dipasang
/radius remove [find comment~"go-wifiads"]
/ip hotspot walled-garden ip remove [find comment~"go-wifiads"]

# 2. Daftarkan Server Go sebagai RADIUS Client (Auth: 1812, Acct: 1813)
/radius add service=hotspot address=$serverIp secret=$radiusSecret authentication-port=1812 accounting-port=1813 timeout=3s comment="go-wifiads-radius"

# 3. Konfigurasi Hotspot Profile agar menggunakan RADIUS & Accounting
:local profId [/ip hotspot profile find default=yes]
:if ([:len $profId] = 0) do={
    :set profId [/ip hotspot profile find where name="hsprof1"]
}
:if ([:len $profId] = 0) do={
    :set profId [/ip hotspot profile find]
}

/ip hotspot profile set $profId \
    use-radius=yes \
    radius-accounting=yes \
    radius-interim-update=5m \
    radius-mac-format=XX:XX:XX:XX:XX:XX \
    login-by=http-pap,http-chap \
    nas-port-type=wireless-802.11

# 4. Walled Garden: Izinkan perangkat yang belum login membuka server portal laptop
/ip hotspot walled-garden ip add dst-address=$serverIp action=accept comment="go-wifiads-portal-server"

:put ("[+] Konfigurasi RADIUS dan Walled Garden berhasil dipasang!")
:put ("[!] LANGKAH TERAKHIR: Upload file login.html ke folder 'hotspot' di menu Files MikroTik.")
