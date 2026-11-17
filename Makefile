SHELL := /bin/sh
GO := go
BIN_DIR := bin

.PHONY: help tidy frontend-build build vet test test-e2e run-api run-radius migrate radiustest fmt clean

help:
	@echo "make tidy        - download and tidy modules"
	@echo "make frontend-build - build the React admin frontend"
	@echo "make build       - build the React frontend and all binaries into ./bin"
	@echo "make vet         - run go vet"
	@echo "make test        - run unit tests"
	@echo "make test-e2e    - run the end-to-end acceptance test (needs PostgreSQL)"
	@echo "make migrate     - create schemas, migrate tables and seed"
	@echo "make run-api     - run the HTTP API and portal"
	@echo "make run-radius  - run the RADIUS server"
	@echo "make radiustest  - example RADIUS client calls (see cmd/radiustest)"
	@echo "make clean       - remove build output"

tidy:
	$(GO) mod tidy

frontend-build:
	npm --prefix admin run build

build: frontend-build
	$(GO) build -o $(BIN_DIR)/server ./cmd/server
	$(GO) build -o $(BIN_DIR)/radius ./cmd/radius
	$(GO) build -o $(BIN_DIR)/migrate ./cmd/migrate
	$(GO) build -o $(BIN_DIR)/radiustest ./cmd/radiustest

vet:
	$(GO) vet ./...

test:
	$(GO) test ./...

test-e2e:
	$(GO) test -tags e2e ./test/e2e -v

migrate:
	$(GO) run ./cmd/migrate

run-api:
	$(GO) run ./cmd/server

run-radius:
	$(GO) run ./cmd/radius

clean:
	rm -rf $(BIN_DIR)
