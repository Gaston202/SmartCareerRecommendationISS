.PHONY: install dev lint format test

# Install dependencies in the correct order to avoid jobspy's numpy==1.26.3
# pin breaking Python 3.14 (no wheel available, source build fails).
install:
	pip install "numpy>=2.0.0" "pandas>=2.2.0"
	pip install python-jobspy --no-deps
	pip install -r requirements.txt

dev:
	uvicorn app.main:app --reload --host 0.0.0.0 --port 3000

lint:
	ruff check app tests

format:
	ruff check --fix app tests

test:
	pytest
