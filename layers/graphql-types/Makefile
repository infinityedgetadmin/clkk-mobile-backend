# GraphQL Types Layer Makefile

.PHONY: build clean

build-GraphQLTypesLayer:
	@echo "Building GraphQL Types layer..."
	cd nodejs && npm install --omit=dev
	mkdir -p $(ARTIFACTS_DIR)/nodejs
	cp -r nodejs/src/* $(ARTIFACTS_DIR)/nodejs/
	@echo "GraphQL Types layer built successfully"

clean:
	rm -rf nodejs/dist
	rm -rf nodejs/package-lock.json