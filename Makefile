.PHONY: setup dev migrate seed lint test hooks help
.DEFAULT_GOAL := help

# Colors
GREEN  := $(shell tput -Txterm setaf 2)
YELLOW := $(shell tput -Txterm setaf 3)
RESET  := $(shell tput -Txterm sgr0)

##@ Setup
hooks: ## Install pre-commit hooks (run once after setup)
	pre-commit install

setup: ## Fully bootstrap the local development environment
	@echo "$(GREEN)Starting local databases...$(RESET)"
	docker compose up -d db
	@echo "$(GREEN)Waiting for Postgres to be ready...$(RESET)"
	@until docker compose exec db pg_isready -U postgres > /dev/null 2>&1; do sleep 1; done
	@echo "$(GREEN)Installing Python backend dependencies via uv...$(RESET)"
	cd backend && uv sync
	@echo "$(GREEN)Creating test database if needed...$(RESET)"
	docker compose exec db psql -U postgres -tc "SELECT 1 FROM pg_database WHERE datname='infinity_test'" | grep -q 1 || docker compose exec db psql -U postgres -c "CREATE DATABASE infinity_test"
	@echo "$(GREEN)Running Alembic database migrations...$(RESET)"
	cd backend && PYTHONPATH=. DATABASE_URL="postgresql+asyncpg://postgres:password@127.0.0.1:5432/infinity" uv run alembic upgrade head
	@echo "$(GREEN)Installing Frontend Node dependencies...$(RESET)"
	npm ci
	@echo "$(GREEN)Environment flawlessly bootstrapped! 🎉$(RESET)"

##@ Development
migrate: ## Run pending Alembic migrations
	@echo "$(GREEN)Starting database...$(RESET)"
	docker compose up -d db
	@until docker compose exec db pg_isready -U postgres > /dev/null 2>&1; do sleep 1; done
	@echo "$(GREEN)Running database migrations...$(RESET)"
	cd backend && PYTHONPATH=. DATABASE_URL="postgresql+asyncpg://postgres:password@127.0.0.1:5432/infinity" uv run alembic upgrade head

dev: migrate ## Concurrent launch of the Vite frontend and Uvicorn backend
	@echo "$(GREEN)Starting Development Servers...$(RESET)"
	npx concurrently -k -c "blue.bold,green.bold" \
		"cd backend && DATABASE_URL='postgresql+asyncpg://postgres:password@127.0.0.1:5432/infinity' uv run uvicorn app.main:app --reload --port 8000" \
		"npm run dev"

seed: ## Import game data JSON files into the local database
	@echo "$(GREEN)Importing game data into database...$(RESET)"
	cd backend && DATABASE_URL='postgresql+asyncpg://postgres:password@127.0.0.1:5432/infinity' uv run python -m app.etl.import_json

##@ Verification
lint: ## Run aggressive linting & type checks across stack
	@echo "$(YELLOW)Linting Python (ruff/mypy) & Node (eslint)...$(RESET)"
	cd backend && uv run ruff format . && uv run ruff check --fix .
	cd backend && uv run mypy .  # strict = true is set in pyproject.toml
	npm run lint

test: ## Execute complete unit test suites
	@echo "$(YELLOW)Running pytest and vitest...$(RESET)"
	cd backend && DATABASE_URL="postgresql+asyncpg://postgres:password@127.0.0.1:5432/infinity" uv run pytest
	npm run test

help:  ## Display this help
	@awk 'BEGIN {FS = ":.*##"; printf "\nUsage:\n  make \033[36m<target>\033[0m\n"} /^[a-zA-Z_-]+:.*?##/ { printf "  \033[36m%-15s\033[0m %s\n", $$1, $$2 } /^##@/ { printf "\n\033[1m%s\033[0m\n", substr($$0, 5) } ' $(MAKEFILE_LIST)
