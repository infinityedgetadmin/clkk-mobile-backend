# Powertools Layer Makefile

.PHONY: build clean

build-PowertoolsLayer:
	@echo "Building Powertools layer..."
	cd nodejs && npm install --production
	cd nodejs && npx tsc --init --target es2022 --module commonjs --outDir ./dist --rootDir ./src --esModuleInterop true --skipLibCheck true --forceConsistentCasingInFileNames true
	cd nodejs && npx tsc
	cp -r nodejs/node_modules $(ARTIFACTS_DIR)/
	cp -r nodejs/dist/* $(ARTIFACTS_DIR)/
	@echo "Powertools layer built successfully"

clean:
	rm -rf nodejs/node_modules
	rm -rf nodejs/dist
	rm -rf nodejs/package-lock.json