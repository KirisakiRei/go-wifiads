# =====================================================================
# WiFiAds — Complete MikroTik Hotspot + RADIUS + Auto login.html Script
# Compatible with RouterOS v5.x, v6.x, and v7.x
# =====================================================================
# Cara Pakai (Tanpa perlu upload login.html manual ke folder hotspot!):
# 1. Upload file .rsc ini ke menu Files di WebFig / WinBox (di root juga bisa),
#    lalu jalankan di New Terminal:
#      /import file-name=wifiads-setup.rsc
# 2. ATAU langsung Copy-Paste seluruh isi script ini ke New Terminal!
# =====================================================================

:local nasId "wifiads-router"
:local radiusServerIp "13.54.63.73"
:local radiusSecret "TTLf6ti8jVNZXucPxxM9+ECa7cxEG9LM"
:local portalDomain "wifiads.smartscales.web.id"
:local portalUrl "https://wifiads.smartscales.web.id/portal"
:local hotspotAddress "10.10.0.1"

:put ("[*] Memulai provisioning WiFiAds untuk NAS: " . $nasId)

# 1. Set System Identity agar sesuai dengan NAS-Identifier di Server
/system identity set name=$nasId

# 2. Bersihkan konfigurasi RADIUS & Walled Garden lama
/ip hotspot walled-garden ip remove [find comment~"wifiads"]
/ip hotspot walled-garden remove [find dynamic=no comment~"wifiads"]
/radius remove [find comment~"wifiads"]
/radius remove [find address=$radiusServerIp]

# 3. Tambahkan Server RADIUS (Auth UDP 1812, Acct UDP 1813)
/radius add service=hotspot address=$radiusServerIp secret=$radiusSecret \
    authentication-port=1812 accounting-port=1813 timeout=3s comment="wifiads-radius"

# 4. Konfigurasi Hotspot Server Profile (HTTP-PAP + RADIUS + Accounting)
:local profId [/ip hotspot profile find where name="wifiads-profile"]
:if ([:len $profId] = 0) do={
    :set profId [/ip hotspot profile find default=yes]
}
/ip hotspot profile set $profId \
    html-directory=hotspot \
    login-by=cookie,http-pap \
    http-cookie-lifetime=1d \
    use-radius=yes \
    radius-accounting=yes \
    radius-interim-update=5m \
    radius-mac-format=XX:XX:XX:XX:XX:XX \
    nas-port-type=wireless-802.11

# Pastikan User Profile default mengizinkan rate-limit dari RADIUS
/ip hotspot user profile set [find default=yes] shared-users=1 transparent-proxy=no

# 5. Walled Garden: Izinkan akses ke Domain & IP Server Portal sebelum login
/ip hotspot walled-garden add dst-host=$portalDomain action=allow comment="wifiads-vps-domain"
/ip hotspot walled-garden ip add dst-address=$radiusServerIp action=accept comment="wifiads-vps-ip"

# 6. Auto-Generate file hotspot/login.html (Mengatasi limitasi upload WebFig!)
:if ([:len [/file find name="hotspot/login.html"]] = 0) do={
    :put "[*] Mereset struktur folder hotspot bawaan..."
    /ip hotspot reset-html [find]
    :delay 2s
}

:local loginHtml ("<!DOCTYPE html><html><head><meta charset=\"utf-8\"><meta name=\"viewport\" content=\"width=device-width,initial-scale=1\"><meta http-equiv=\"refresh\" content=\"0; url=" . $portalUrl . "?mac=\$(mac)&ip=\$(ip)&nasid=" . $nasId . "&link-login-only=\$(link-login-only-esc)&link-login=\$(link-login-esc)&link-orig=\$(link-orig-esc)\"><title>Mengarahkan ke Portal Wi-Fi...</title></head><body style=\"font-family:sans-serif;background:#f1f5f9;color:#0f172a;display:flex;align-items:center;justify-content:center;height:100vh;margin:0;text-align:center\"><div style=\"background:#fff;padding:28px 24px;border-radius:16px;border:1px solid #e2e8f0;max-width:340px;width:90%\"><h3 style=\"margin:0 0 8px\">Mengarahkan ke Portal...</h3><p style=\"font-size:14px;color:#64748b;margin:0 0 18px\">Jika tidak berpindah otomatis, ketuk tombol di bawah:</p><a href=\"" . $portalUrl . "?mac=\$(mac)&ip=\$(ip)&nasid=" . $nasId . "&link-login-only=\$(link-login-only-esc)&link-login=\$(link-login-esc)&link-orig=\$(link-orig-esc)\" style=\"display:inline-block;background:#2563eb;color:#fff;text-decoration:none;padding:12px 22px;border-radius:10px;font-weight:600;font-size:14px\">Buka Halaman Login</a></div></body></html>")

/file set [find name="hotspot/login.html"] contents=$loginHtml

:put "[+] Provisioning WiFiAds selesai! RADIUS, Walled Garden, dan hotspot/login.html sudah aktif."
