.PHONY: setup dev migrate etl lint test hooks help
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
	@echo "$(GREEN)Creating test database if needed...$(RESET)"
	docker compose exec db psql -U postgres -tc "SELECT 1 FROM pg_database WHERE datname='infinity_test'" | grep -q 1 || docker compose exec db psql -U postgres -c "CREATE DATABASE infinity_test"
	@echo "$(GREEN)Installing Frontend Node dependencies...$(RESET)"
	npm ci
	@echo "$(GREEN)Installing TypeScript backend Node dependencies...$(RESET)"
	cd backend-ts && npm ci
	@echo "$(GREEN)Running Drizzle database migrations...$(RESET)"
	cd backend-ts && DATABASE_URL='postgresql://postgres:password@127.0.0.1:5432/infinity' npm run db:migrate
	@echo "$(GREEN)Environment flawlessly bootstrapped! 🎉$(RESET)"

etl: ## Process raw game data into static JSON files
	@echo "$(GREEN)Running ETL pipeline...$(RESET)"
	npm run etl

##@ Development
migrate: ## Run pending Drizzle migrations
	@echo "$(GREEN)Starting database...$(RESET)"
	docker compose up -d db
	@until docker compose exec db pg_isready -U postgres > /dev/null 2>&1; do sleep 1; done
	@echo "$(GREEN)Running database migrations...$(RESET)"
	cd backend-ts && DATABASE_URL='postgresql://postgres:password@127.0.0.1:5432/infinity' npm run db:migrate

dev: migrate ## Concurrent launch of the Vite frontend and TypeScript backend
	@echo "$(GREEN)Starting Development Servers...$(RESET)"
	npx concurrently -k -c "blue.bold,green.bold" \
		"cd backend-ts && DATABASE_URL='postgresql://postgres:password@127.0.0.1:5432/infinity' DEV_AUTH=true PORT=8000 npm run dev" \
		"npm run dev"

##@ Verification
lint: ## Run linting & type checks across the TypeScript stack
	@echo "$(YELLOW)Linting & typechecking TypeScript backend...$(RESET)"
	cd backend-ts && npm run lint && npm run typecheck
	@echo "$(YELLOW)Linting & typechecking frontend...$(RESET)"
	npm run lint && npm run typecheck

test: ## Execute complete unit test suites
	@echo "$(YELLOW)Running backend-ts vitest and frontend vitest...$(RESET)"
	cd backend-ts && DATABASE_URL='postgresql://postgres:password@127.0.0.1:5432/infinity' DEV_AUTH=true npm test
	npm run test

help:  ## Display this help
	@awk 'BEGIN {FS = ":.*##"; printf "\nUsage:\n  make \033[36m<target>\033[0m\n"} /^[a-zA-Z_-]+:.*?##/ { printf "  \033[36m%-15s\033[0m %s\n", $$1, $$2 } /^##@/ { printf "\n\033[1m%s\033[0m\n", substr($$0, 5) } ' $(MAKEFILE_LIST)
