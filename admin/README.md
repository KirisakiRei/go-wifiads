# WiFiAds Admin

React + Vite + TypeScript application for the WiFiAds SaaS admin console.

## Development

1. Run the Go API on `http://localhost:8080`.
2. From this directory, install dependencies and start Vite:

   ```sh
   npm install
   npm run dev
   ```

Vite proxies `/api` to the Go server. Authentication remains cookie-based; frontend requests must use `credentials: 'include'`.

## Current scope

This directory is only the application foundation. The existing Go-rendered admin remains active until the React pages reach feature parity and the Go router is updated to serve `admin/dist`.

The captive portal remains in `web/` for now and is intentionally untouched.
