# Powertools Layer Makefile

.PHONY: build clean

build-PowertoolsLayer:
	@echo "Building Powertools layer..."
	cd nodejs && npm install --omit=dev
	cp -r nodejs/node_modules $(ARTIFACTS_DIR)/
	@echo "Powertools layer built successfully"

clean:
	rm -rf nodejs/node_modules
	rm -rf nodejs/dist
	rm -rf nodejs/package-lock.json