.PHONY: dev lint format test

dev:
	uvicorn app.main:app --reload --host 0.0.0.0 --port 3000

lint:
	ruff check app tests

format:
	ruff check --fix app tests

test:
	pytest
