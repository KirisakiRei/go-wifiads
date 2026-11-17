# Migrations

Skema Alpha dikelola oleh `cmd/migrate` (GORM AutoMigrate) karena ruang lingkup
masih kecil dan berubah cepat. Folder ini menyimpan catatan SQL untuk rujukan
manual dan verifikasi.

```bash
# membuat schema app + radius, tabel, dan data seed
make migrate
```

## Schema

- `app`: `admin_users`, `sites`, `routers`, `portal_sessions`, `wifi_visitors`,
  `advertisements`, `audit_logs`
- `radius`: `nas_clients`, `vouchers`, `accounting_sessions`, `accounting_events`

## Catatan penting

- `radius.nas_clients.secret_ciphertext` dan `radius.vouchers.password_ciphertext`
  disimpan dengan AES-256-GCM. Keduanya **harus** bisa didekripsi karena RADIUS
  perlu plaintext untuk memverifikasi digest paket dan menghitung respons CHAP.
- Password admin memakai bcrypt (satu arah).
- Semua waktu disimpan dalam UTC.
- Unique key: `vouchers.username`, `(nas_identifier, acct_session_id)`,
  `accounting_events.event_key`, `portal_sessions.token_hash`.
