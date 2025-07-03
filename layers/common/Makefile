# Common Layer Makefile

.PHONY: build clean

build-CommonLayer:
	@echo "Building Common layer..."
	cd nodejs && npm install --omit=dev
	mkdir -p $(ARTIFACTS_DIR)/nodejs
	cp -r nodejs/node_modules $(ARTIFACTS_DIR)/nodejs/
	cp -r nodejs/src/* $(ARTIFACTS_DIR)/nodejs/
	@echo "Common layer built successfully"

clean:
	rm -rf nodejs/node_modules
	rm -rf nodejs/dist
	rm -rf nodejs/package-lock.json