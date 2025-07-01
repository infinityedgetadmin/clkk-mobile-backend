# Constants Layer Makefile

.PHONY: build clean

build-ConstantsLayer:
	@echo "Building Constants layer..."
	cd nodejs && npm init -y
	cd nodejs && npx tsc --init --target es2022 --module commonjs --outDir ./dist --rootDir ./src --esModuleInterop true --skipLibCheck true --forceConsistentCasingInFileNames true --declaration true
	cd nodejs && npx tsc
	cp -r nodejs/dist/* $(ARTIFACTS_DIR)/
	@echo "Constants layer built successfully"

clean:
	rm -rf nodejs/dist
	rm -rf nodejs/package-lock.json