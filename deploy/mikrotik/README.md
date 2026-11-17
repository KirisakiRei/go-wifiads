# Panduan Setup MikroTik Hotspot (WiFiAds Alpha)

## Langkah Cepat:

1. **Cari IP Laptop Kau:**
   - Di CMD/PowerShell laptop, ketik `ipconfig`.
   - Cari IPv4 interface yang terhubung ke MikroTik (misal `192.168.88.254`).

2. **Sesuaikan File:**
   - Buka `wifiads-setup.rsc`, ganti `serverIp "192.168.88.254"` dengan IP laptop kau.
   - Buka `login.html`, ganti `192.168.88.254` dengan IP laptop kau.

3. **Import Script di MikroTik:**
   - Buka Winbox -> drag file `wifiads-setup.rsc` ke menu **Files**.
   - Buka menu **New Terminal**, jalankan:
     ```rsc
     /import file-name=wifiads-setup.rsc
     ```

4. **Upload File `login.html`:**
   - Di Winbox menu **Files**, cari folder `hotspot` (atau `flash/hotspot`).
   - Timpa (replace) file `login.html` bawaan MikroTik dengan file `login.html` dari folder ini.

5. **Jalankan Backend di Laptop:**
   - Terminal 1: `DB_PASSWORD=postgres ./bin/server.exe`
   - Terminal 2: `DB_PASSWORD=postgres ./bin/radius.exe`

6. **Tes Koneksi:**
   - Sambungkan HP ke Wi-Fi MikroTik.
   - Pop-up captive portal otomatis terbuka, tunggu iklan 5 detik, klik tombol Connect, dan internet langsung aktif!
