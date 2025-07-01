# Entities Layer Makefile

.PHONY: build clean

build-EntitiesLayer:
	@echo "Building Entities layer..."
	cd nodejs && npm init -y && npm install \
		@aws-sdk/client-dynamodb \
		@aws-sdk/lib-dynamodb \
		zod
	cd nodejs && npx tsc --init --target es2022 --module commonjs --outDir ./dist --rootDir ./src --esModuleInterop true --skipLibCheck true --forceConsistentCasingInFileNames true --declaration true
	cd nodejs && npx tsc
	cp -r nodejs/node_modules $(ARTIFACTS_DIR)/
	cp -r nodejs/dist/* $(ARTIFACTS_DIR)/
	@echo "Entities layer built successfully"

clean:
	rm -rf nodejs/node_modules
	rm -rf nodejs/dist
	rm -rf nodejs/package-lock.json