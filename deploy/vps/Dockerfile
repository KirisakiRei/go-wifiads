# syntax=docker/dockerfile:1

# ---- Stage 1: build the React admin console (emitted into portal/static/admin) ----
FROM node:22-alpine AS frontend
WORKDIR /src
COPY admin/package.json admin/package-lock.json ./admin/
RUN npm ci --prefix admin
COPY admin/ ./admin/
RUN npm run build --prefix admin

# ---- Stage 2: compile the Go binaries with the embedded frontend ----
FROM golang:1.24-alpine AS backend
WORKDIR /src
COPY go.mod go.sum ./
RUN go mod download
COPY . .
COPY --from=frontend /src/portal/static/admin/ ./portal/static/admin/
ENV CGO_ENABLED=0 GOOS=linux
RUN go build -trimpath -ldflags="-s -w" -o /out/server  ./cmd/server  && \
    go build -trimpath -ldflags="-s -w" -o /out/radius  ./cmd/radius  && \
    go build -trimpath -ldflags="-s -w" -o /out/migrate ./cmd/migrate

# ---- Stage 3: minimal runtime ----
# ca-certificates is needed for outbound HTTPS, tzdata for RADIUS accounting
# timestamps in the site timezone (SEED_SITE_TIMEZONE).
FROM alpine:3.21
RUN apk add --no-cache ca-certificates tzdata ffmpeg && adduser -D -u 10001 wifiads
WORKDIR /app
COPY --from=backend /out/server  /app/server
COPY --from=backend /out/radius  /app/radius
COPY --from=backend /out/migrate /app/migrate
RUN mkdir -p /app/uploads/ads && chown -R wifiads:wifiads /app
USER wifiads
EXPOSE 8080/tcp 1812/udp 1813/udp
ENTRYPOINT ["/app/server"]
