# GraphQL Types Layer Makefile

.PHONY: build clean

build-GraphQLTypesLayer:
	@echo "Building GraphQL Types layer..."
	mkdir -p $(ARTIFACTS_DIR)/nodejs
	echo '// GraphQL Types Layer' > $(ARTIFACTS_DIR)/nodejs/index.js
	@echo "GraphQL Types layer built successfully"

clean:
	rm -rf nodejs/dist
	rm -rf nodejs/package-lock.json