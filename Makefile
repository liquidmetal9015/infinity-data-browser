.PHONY: setup dev lint test
.DEFAULT_GOAL := help

# Colors
GREEN  := $(shell tput -Txterm setaf 2)
YELLOW := $(shell tput -Txterm setaf 3)
RESET  := $(shell tput -Txterm sgr0)

##@ Setup
setup: ## Fully bootstrap the local development environment
	@echo "$(GREEN)Starting local databases...$(RESET)"
	docker compose up -d db
	@echo "$(GREEN)Installing Python backend dependencies via uv...$(RESET)"
	cd backend && uv sync
	@echo "$(GREEN)Running Alembic database migrations...$(RESET)"
	cd backend && PYTHONPATH=. DATABASE_URL="postgresql+asyncpg://postgres:password@127.0.0.1:5432/infinity" uv run alembic upgrade head
	@echo "$(GREEN)Installing Frontend Node dependencies...$(RESET)"
	npm install
	@echo "$(GREEN)Environment flawlessly bootstrapped! 🎉$(RESET)"

##@ Development
dev: ## Concurrent launch of the Vite frontend and Uvicorn backend
	@echo "$(GREEN)Starting Development Servers...$(RESET)"
	docker compose up -d db
	npx concurrently -k -c "blue.bold,green.bold" \
		"cd backend && DATABASE_URL='postgresql+asyncpg://postgres:password@127.0.0.1:5432/infinity' uv run uvicorn app.main:app --reload --port 8000" \
		"npm run dev"

##@ Verification
lint: ## Run aggressive linting & type checks across stack
	@echo "$(YELLOW)Linting Python (ruff/mypy) & Node (eslint)...$(RESET)"
	cd backend && uv run ruff format . && uv run ruff check --fix .
	cd backend && uv run mypy .
	npm run lint

test: ## Execute complete unit test suites
	@echo "$(YELLOW)Running pytest and vitest...$(RESET)"
	cd backend && DATABASE_URL="postgresql+asyncpg://postgres:password@127.0.0.1:5432/infinity" uv run pytest
	npm run test

help:  ## Display this help
	@awk 'BEGIN {FS = ":.*##"; printf "\nUsage:\n  make \033[36m<target>\033[0m\n"} /^[a-zA-Z_-]+:.*?##/ { printf "  \033[36m%-15s\033[0m %s\n", $$1, $$2 } /^##@/ { printf "\n\033[1m%s\033[0m\n", substr($$0, 5) } ' $(MAKEFILE_LIST)
