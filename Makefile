SHELL := /bin/bash

.PHONY: help setup up down logs ps smoke cluster-smoke lint

help:
	@echo "Targets:"
	@echo "  setup  - create .env from .env.example if missing"
	@echo "  up     - start all services"
	@echo "  down   - stop all services"
	@echo "  logs   - tail compose logs"
	@echo "  ps     - list containers"
	@echo "  smoke  - run local API smoke checks"
	@echo "  cluster-smoke - run mirrored cluster pipeline from Classic_Version"

setup:
	@test -f .env || cp .env.example .env
	@echo "Environment ready (.env)"

up:
	docker compose up -d --build

down:
	docker compose down

logs:
	docker compose logs -f --tail=100

ps:
	docker compose ps

smoke:
	./scripts/smoke.sh

cluster-smoke:
	./scripts/run_cluster_parallel.sh
