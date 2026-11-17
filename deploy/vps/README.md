# Deploy ke VPS (nginx + Docker Compose)

Target: Ubuntu 24.04, 1 GB RAM, nginx di host, aplikasi di container.

```
Internet :80/:443
    -> nginx (host)
        -> 127.0.0.1:8080   wifiads-api
RADIUS UDP 1812/1813        wifiads-radius  (langsung, nginx tidak proxy UDP)
                            wifiads-postgres (volume pgdata)
```

## Kenapa nginx di host, bukan container

Satu container lebih sedikit (~10 MB) dan tidak perlu network bridging
tambahan. nginx juga yang memegang sertifikat Let's Encrypt dan melakukan
rencana renew.

## Prasyarat

1. DNS Cloudflare: `A wifiads -> 13.54.63.73`, **proxy grey cloud (DNS only)**,
   tanpa record AAAA.
2. Firewall Lightsail: TCP 80, 443 dan UDP 1812, 1813 terbuka.
3. Docker + Compose plugin sudah terpasang.

## Langkah

```bash
git clone -b develop https://github.com/KirisakiRei/go-wifiads.git ~/go-wifiads
cd ~/go-wifiads/deploy/vps

cp .env.production.example ../../.env
openssl rand -base64 48   # -> JWT_SECRET
openssl rand -base64 32   # -> VOUCHER_ENC_KEY
openssl rand -base64 32   # -> RADIUS_SECRET_ENC_KEY
openssl rand -base64 18   # -> SEED_ADMIN_PASSWORD
nano ../../.env

sudo bash setup.sh
```

`setup.sh` idempoten: menginstall nginx + certbot, menerbitkan sertifikat,
build image, menjalankan stack, lalu menunggu `/health/live`.

## Setelah deploy

```bash
cd ~/go-wifiads/deploy/vps
docker compose --env-file ../../.env ps
docker compose --env-file ../../.env logs -f api
```

Admin: `https://wifiads.smartscales.web.id/admin`

## Konfigurasi MikroTik

Samakan `secret` dengan `SEED_NAS_SHARED_SECRET`, dan arahkan ke IP publik VPS:

```
/radius add service=hotspot address=13.54.63.73 secret="<SEED_NAS_SHARED_SECRET>" \
  authentication-port=1812 accounting-port=1813 timeout=3s
```

Uji dari router:

```
/radius monitor 0
```

## Catatan memori

Batas per container: postgres 256 MB, api 192 MB, radius 128 MB.
Transaksi `max_connections=30` dan `shared_buffers=64MB` sengaja kecil.
Kalau VPS mulai swap terus-menerus, turunkan `DB_MAX_OPEN_CONNS` di `.env`.

## Update aplikasi

```bash
cd ~/go-wifiads && git pull
cd deploy/vps
docker compose --env-file ../../.env build api
docker compose --env-file ../../.env up -d
```

Flow migrasi otomatis berjalan sebelum `api` (service `migrate`,
`service_completed_successfully`).

## Troubleshooting singkat

| Gejala | Cek |
|---|---|
| Certbot gagal | DNS masih proxied, atau port 80 tertutup di Lightsail |
| `api` restart terus | `docker compose logs api` — biasanya `.env` gagal validasi |
| Login hotspot gagal | RADIUS belum sampai: cek UDP 1812 dari luar dan `secret` NAS |
| Upload iklan hilang | volume `./uploads` terhapus saat re-deploy |
