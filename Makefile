.PHONY: dev build test test-rust test-frontend test-e2e clean

dev: kill
	npm run tauri dev

kill:
	@lsof -ti :1420 | xargs kill -9 2>/dev/null || true

build:
	npm run tauri build

# Run all non-E2E tests
test: test-rust test-frontend

test-rust:
	cd src-tauri && cargo test

test-frontend:
	npm run test

# Requires: cargo install tauri-driver  +  make build first
test-e2e:
	npm run test:e2e

clean:
	rm -rf dist src-tauri/target
