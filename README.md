# WiFi Ads Alpha — Wi-Fi Advertising & Captive Portal Platform

Implementasi Alpha 0.1 dari PRD: captive portal eksternal untuk MikroTik Hotspot,
voucher sementara, RADIUS authentication + accounting, dan dashboard admin minimum.

Arsitektur mengikuti `AGENTS.md`: Router → Handler → Service → Repository → GORM.

## Komponen

| Binary | Fungsi |
|---|---|
| `cmd/server` | HTTP API + halaman portal + dashboard admin |
| `cmd/radius` | RADIUS server (UDP 1812 auth, 1813 accounting) |
| `cmd/migrate` | Membuat schema, tabel, dan data seed |
| `cmd/radiustest` | Client RADIUS untuk pengujian tanpa MikroTik |

Dependensi: Go >= 1.24, PostgreSQL (native, tanpa Docker), MikroTik RouterOS 6 untuk uji nyata.

## Yang sudah ada (Alpha 0.1)

- Portal eksternal dengan iklan placeholder + countdown 5 detik (divalidasi di backend).
- UI portal **clean & mobile-first** dengan tiga layar: *Selamat Datang* → *Iklan +
  countdown ring* → *Terhubung* (hero hijau + statistik + Info & Tips),
  responsif dari HP sampai desktop (`web/static/css/portal.css`).
- Portal session bertoken acak; token disimpan sebagai hash SHA-256.
- Penerbitan voucher otomatis saat Connect, **idempotent** (1 sesi = 1 voucher)
  yang ditegakkan di level database (`voucher.CrearForPortalSession`), aman
  terhadap klik ganda/retry bersamaan.
- Voucher password acak (default 12 karakter) disimpan dengan **AES-256-GCM**
  (wajib untuk CHAP), tidak pernah ditampilkan ulang di dashboard.
- RADIUS auth: PAP dan CHAP, validasi NAS + shared secret, binding router & MAC,
  status/expiry voucher, `Session-Timeout`, `Port-Limit = 1`.
- RADIUS accounting: Start/Interim/Stop idempotent, raw event dedup, stale detection.
- Admin: login JWT (cookie httpOnly), buat voucher uji, daftar voucher,
  daftar pengguna/perangkat, daftar sesi, overview. Dashboard admin juga responsif
  (nav pill, kartu statistik, tabel scroll horizontal di mobile).
- Semua endpoint list memakai pagination; response seragam `httpx`.

Tidak termasuk (sesuai PRD): multi-site penuh, campaign dinamis, IPsec/VICI,
CoA, batch voucher, analitik lanjutan.

## Setup development (Windows)

1. Buat database PostgreSQL:

   ```sql
   CREATE DATABASE wifi_advertising;
   ```

2. Salin environment dan isi kredensial + key:

   ```bash
   cp .env.example .env
   # isi DB_PASSWORD, JWT_SECRET, VOUCHER_ENC_KEY, RADIUS_SECRET_ENC_KEY
   ```

   Generate key 32 byte (AES-256):

   ```bash
   openssl rand -base64 32
   ```

   Di `APP_ENV=development` key boleh kosong (dipakai key dev deterministik),
   tetapi **production wajib** mengisi semuanya.

3. Migrasi + seed:

   ```bash
   go run ./cmd/migrate
   ```

4. Jalankan dua proses di terminal berbeda:

   ```bash
   go run ./cmd/server     # http://localhost:8080
   go run ./cmd/radius     # UDP :1812 dan :1813
   ```

5. Buka portal: <http://localhost:8080/portal>, admin: <http://localhost:8080/admin/login>.

   Kredensial seed default: `admin` / `admin12345` (ubah lewat `SEED_ADMIN_PASSWORD`).

## Uji tanpa MikroTik

`PORTAL_DEV_MODE=true` membuat `link-login-only` opsional: setelah Connect,
portal menampilkan username/password voucher alih-alih submit ke Hotspot.

Uji RADIUS langsung:

```bash
# 1. buat voucher manual di dashboard, lalu:
go run ./cmd/radiustest -mode auth -user <username> -pass <password>
go run ./cmd/radiustest -mode auth -user <username> -pass <password> -chap
go run ./cmd/radiustest -mode accounting -status Start -user <username> -session s1
go run ./cmd/radiustest -mode accounting -status Stop  -user <username> -session s1 -seconds 120
```

`cmd/radiustest` mengirim dari `127.0.0.1`. Daftarkan NAS dengan
`SEED_NAS_IP=127.0.0.1` bila menguji di satu mesin.

## Konfigurasi MikroTik & Hotspot

### 1. Template `login.html` MikroTik (Redirect ke External Portal)

Upload file `login.html` berikut ke direktori hotspot MikroTik (misal `flash/hotspot/login.html` atau `hotspot/login.html`):

```html
<!DOCTYPE html>
<html>
<head>
    <meta charset="utf-8">
    <meta http-equiv="refresh" content="0; url=http://<IP-ATAU-DOMAIN-PORTAL>:8080/portal?mac=$(mac)&ip=$(ip)&link-login-only=$(link-login-only-esc)&link-login=$(link-login-esc)&link-orig=$(link-orig-esc)&chap-id=$(chap-id)&chap-challenge=$(chap-challenge)">
    <title>Redirecting to Wi-Fi Portal...</title>
</head>
<body>
    <p>Mengarahkan ke halaman login Wi-Fi... Jika tidak berpindah otomatis, <a href="http://<IP-ATAU-DOMAIN-PORTAL>:8080/portal?mac=$(mac)&ip=$(ip)&link-login-only=$(link-login-only-esc)&link-login=$(link-login-esc)&link-orig=$(link-orig-esc)&chap-id=$(chap-id)&chap-challenge=$(chap-challenge)">klik di sini</a>.</p>
</body>
</html>
```

### 2. Konfigurasi RouterOS (CLI)

```rsc
# 1. Tambahkan RADIUS server
/radius add service=hotspot address=<IP-SERVER-GO> secret="testing123" authentication-port=1812 accounting-port=1813 timeout=3s comment="go-wifiads"

# 2. Aktifkan RADIUS & Accounting pada Profile Hotspot
/ip hotspot profile set [find] use-radius=yes radius-accounting=yes radius-interim-update=5m radius-mac-format=XX:XX:XX:XX:XX:XX nas-port-type=wireless-802.11 login-by=http-pap,http-chap

# 3. Walled Garden (izinkan akses ke server portal sebelum login)
/ip hotspot walled-garden add dst-host=<domain-portal> action=allow comment="allow external portal"
/ip hotspot walled-garden ip add dst-address=<IP-SERVER-GO> action=accept comment="allow portal IP"
```

### 3. Firewall Security (UDP 1812 & 1813)

Port RADIUS autentikasi (1812) dan accounting (1813) wajib dilindungi agar hanya menerima paket dari IP MikroTik yang terdaftar:

**Windows PowerShell (Run as Administrator):**
```powershell
New-NetFirewallRule -DisplayName "Allow RADIUS from MikroTik" -Direction Inbound -LocalPort 1812,1813 -Protocol UDP -RemoteAddress <IP-MIKROTIK> -Action Allow
```

**Linux (UFW / iptables):**
```bash
sudo ufw allow from <IP-MIKROTIK> to any port 1812,1813 proto udp comment "RADIUS from MikroTik"
```

## Automated End-to-End Smoke Test

Jalankan server dan radius, lalu uji alur penuh (portal session countdown -> voucher issue -> RADIUS PAP -> RADIUS CHAP -> RADIUS wrong password reject -> Accounting Start -> Accounting Stop -> Admin login -> Admin manual voucher):

```bash
# Build binary
go build -o bin/server.exe ./cmd/server
go build -o bin/radius.exe ./cmd/radius
go build -o bin/smoke.exe ./cmd/smoke

# Set env & run
export DB_PASSWORD=postgres
export PORTAL_DEV_MODE=true
export PORTAL_AD_DURATION_SECONDS=2
export SMOKE_RADIUS=1

# Jalankan server dan radius daemon di background, lalu eksekusi smoke:
./bin/smoke.exe
```

## Testing

```bash
# Unit tests
make test          # go test ./...
make vet           # go vet ./...
make build         # go build semua binary

# End-to-end acceptance test (butuh PostgreSQL yang berjalan)
make test-e2e      # go test -tags e2e ./test/e2e -v
```

### Unit test

Mencakup:

- CHAP, AES-GCM round trip, dan matematika pagination (`pkg/utils`).
- Portal: countdown dipaksa backend, Connect idempotent **termasuk 8 klik
  bersamaan** (`TestConnectConcurrentIsIdempotent`).
- RADIUS auth: accept PAP/CHAP, reject karena password salah, expired, revoked,
  used, MAC mismatch, unknown NAS, router mismatch, dan konflik sesi aktif
  (`internal/service/radius_auth_service_test.go`).
- Accounting: lifecycle Start/Stop, stale detection, dan **Start duplikat**
  tidak membuat sesi ganda.

### End-to-end (E2E)

`test/e2e` menjalankan server HTTP + RADIUS **nyata** di atas PostgreSQL
terisolasi (database dibuat dan dihapus otomatis), lalu mendorong alur persis
seperti hotspot sungguhan — tanpa perlu MikroTik fisik. Konfigurasi koneksi DB
lewat env `E2E_DB_HOST`, `E2E_DB_PORT`, `E2E_DB_USER`, `E2E_DB_PASSWORD`
(default `localhost:5432`, `postgres/postgres`).

Skenario yang dicakup:

- `TestAlphaMVPFlow`: portal session → countdown ditolak lebih awal → Connect
  → voucher → RADIUS PAP & CHAP `Access-Accept` → password salah `Access-Reject`
  → Accounting Start/Interim/Stop → voucher ACTIVE→USED → voucher used & expired
  ditolak → shared secret salah tidak memberi akses → endpoint admin OK.
- `TestAccountingIdempotencyAndStale`: retransmisi Accounting-Start tidak membuat
  sesi ganda dan sesi yang berhenti melapor ditandai `STALE`.
- `TestVoucherRepositoryRejectsDuplicatePortalSession`: constraint "1 sesi =
  1 voucher" ditegakkan di database.

## Catatan keamanan

- Parameter redirect browser diperlakukan sebagai metadata, bukan bukti identitas.
  Keputusan akses tetap di RADIUS berdasarkan paket dari NAS terdaftar.
- `link-login-only` divalidasi terhadap allowlist host (wajib di production),
  baik di backend maupun di browser.
- Konfigurasi Hotspot dikirim ke halaman portal sebagai **`application/json`**
  inert (di-parse dengan `JSON.parse`), bukan skrip yang dieksekusi — nilai dari
  query string tidak mungkin disuntikkan sebagai JavaScript.
- **Security headers** dipasang pada semua respons: `Content-Security-Policy`
  (`default-src 'self'`, `script-src 'self'`, `frame-ancestors 'none'`),
  `X-Frame-Options: DENY` (anti-clickjacking), `X-Content-Type-Options: nosniff`,
  `Referrer-Policy: no-referrer`, dan `Strict-Transport-Security` saat production.
- Login admin dibatasi **10 percobaan/menit per IP** (anti brute force), di atas
  rate limit API umum 120/menit.
- Cookie sesi admin bersifat `HttpOnly` + `SameSite=Lax`.
- Voucher dan shared secret NAS dapat didekripsi (AES-GCM) — jangan pernah
  ditulis ke log, dan jangan tampilkan ulang password voucher di dashboard.
- Database gagal atau NAS tidak dikenal ⇒ `Access-Reject` (fail-closed).

## Checklist sebelum production / pilot

Keamanan transport dan deployment **wajib** dipenuhi sebelum dipakai di lapangan:

- [ ] `APP_ENV=production` dan layani portal lewat **HTTPS** (sertifikat valid).
- [ ] `PORTAL_DEV_MODE=false` dan `PORTAL_ALLOWED_LOGIN_HOSTS` diisi host MikroTik.
- [ ] `JWT_SECRET`, `VOUCHER_ENC_KEY`, `RADIUS_SECRET_ENC_KEY` diisi nilai acak kuat.
- [ ] `JWT_COOKIE_SECURE=true` (cookie hanya lewat HTTPS).
- [ ] PostgreSQL tidak diekspos ke internet.
- [ ] UDP `1812/1813` **tidak** dibuka ke internet publik — gunakan IPsec (Phase 3).
- [ ] Windows Firewall / firewall VPS hanya mengizinkan RADIUS dari IP MikroTik.

Catatan CPU MikroTik: TLS untuk portal ditangani **server dan browser**, bukan
MikroTik. MikroTik hanya mengarahkan browser ke portal dan meneruskan paket
RADIUS (UDP), jadi HTTPS portal **tidak membebani CPU router** (RB750 tetap ringan).
