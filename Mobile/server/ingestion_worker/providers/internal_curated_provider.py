from typing import Iterable

from .base import BaseProvider
from ..models import ProviderRecord


class InternalCuratedProvider(BaseProvider):
    provider_name = "internal_curated"

    def fetch(self, filters: dict | None = None) -> Iterable[ProviderRecord]:
        # Curated starter knowledge base for local RAG validation.
        return [
            ProviderRecord(
                provider=self.provider_name,
                provider_resource_id="internal-react-docs",
                source_type="internal_curated",
                resource_type="docs",
                title="React Official Documentation",
                description="Official docs for React fundamentals, hooks, and modern component patterns.",
                source_url="https://react.dev/",
                language="en",
                level="beginner",
                free_or_paid="free",
                skill_tags=["React", "JavaScript", "Frontend"],
                target_roles=["Frontend Developer"],
                raw_content=(
                    "React documentation explains components, props, state, hooks, effects, forms, "
                    "routing patterns, and performance guidance for building frontend applications."
                ),
                normalized_content=(
                    "React documentation explains components props state hooks effects forms routing "
                    "patterns and performance guidance for building frontend applications."
                ),
            ),
            ProviderRecord(
                provider=self.provider_name,
                provider_resource_id="internal-mdn-javascript-guide",
                source_type="internal_curated",
                resource_type="docs",
                title="MDN JavaScript Guide",
                description="Comprehensive JavaScript learning guide covering syntax, functions, arrays, and async concepts.",
                source_url="https://developer.mozilla.org/en-US/docs/Web/JavaScript/Guide",
                language="en",
                level="beginner",
                free_or_paid="free",
                skill_tags=["JavaScript", "Programming Fundamentals", "Frontend"],
                target_roles=["Frontend Developer", "Full Stack Developer"],
                raw_content=(
                    "MDN JavaScript Guide covers variables functions objects arrays promises modules DOM "
                    "manipulation and debugging for developers learning core JavaScript."
                ),
                normalized_content=(
                    "MDN JavaScript Guide covers variables functions objects arrays promises modules DOM "
                    "manipulation and debugging for developers learning core JavaScript."
                ),
            ),
            ProviderRecord(
                provider=self.provider_name,
                provider_resource_id="internal-typescript-handbook",
                source_type="internal_curated",
                resource_type="docs",
                title="TypeScript Handbook",
                description="Official TypeScript handbook for types, interfaces, generics, and tooling.",
                source_url="https://www.typescriptlang.org/docs/handbook/intro.html",
                language="en",
                level="beginner",
                free_or_paid="free",
                skill_tags=["TypeScript", "JavaScript", "Frontend"],
                target_roles=["Frontend Developer", "Full Stack Developer"],
                raw_content=(
                    "TypeScript Handbook teaches static typing interfaces generics unions narrowing and tsconfig "
                    "setup for safer JavaScript applications."
                ),
                normalized_content=(
                    "TypeScript Handbook teaches static typing interfaces generics unions narrowing and tsconfig "
                    "setup for safer JavaScript applications."
                ),
            ),
            ProviderRecord(
                provider=self.provider_name,
                provider_resource_id="internal-nodejs-learn",
                source_type="internal_curated",
                resource_type="docs",
                title="Node.js Learn Documentation",
                description="Guided Node.js learning materials for modules, APIs, async IO, and server development.",
                source_url="https://nodejs.org/en/learn",
                language="en",
                level="beginner",
                free_or_paid="free",
                skill_tags=["Node.js", "JavaScript", "Backend"],
                target_roles=["Backend Developer", "Full Stack Developer"],
                raw_content=(
                    "Node.js Learn documentation introduces modules package management event loop streams "
                    "HTTP servers file system operations and asynchronous backend development."
                ),
                normalized_content=(
                    "Node.js Learn documentation introduces modules package management event loop streams "
                    "HTTP servers file system operations and asynchronous backend development."
                ),
            ),
            ProviderRecord(
                provider=self.provider_name,
                provider_resource_id="internal-express-routing-guide",
                source_type="internal_curated",
                resource_type="tutorial",
                title="Express Routing and Middleware Guide",
                description="Practical guide for REST APIs with Express routing, middleware, and error handling.",
                source_url="https://expressjs.com/en/guide/routing.html",
                language="en",
                level="beginner",
                free_or_paid="free",
                skill_tags=["Express", "Node.js", "Backend", "REST API"],
                target_roles=["Backend Developer", "Full Stack Developer"],
                raw_content=(
                    "Express routing guide explains route handlers middleware request response patterns "
                    "error handling and API composition for backend services."
                ),
                normalized_content=(
                    "Express routing guide explains route handlers middleware request response patterns "
                    "error handling and API composition for backend services."
                ),
            ),
            ProviderRecord(
                provider=self.provider_name,
                provider_resource_id="internal-postgresql-tutorial",
                source_type="internal_curated",
                resource_type="tutorial",
                title="PostgreSQL SQL Tutorial",
                description="SQL tutorial for querying, joins, indexes, constraints, and relational design.",
                source_url="https://www.postgresqltutorial.com/",
                language="en",
                level="beginner",
                free_or_paid="free",
                skill_tags=["PostgreSQL", "SQL", "Database"],
                target_roles=["Backend Developer", "Data Analyst", "Data Engineer"],
                raw_content=(
                    "PostgreSQL tutorial covers SELECT queries joins grouping indexes constraints schema "
                    "design and performance basics for relational databases."
                ),
                normalized_content=(
                    "PostgreSQL tutorial covers SELECT queries joins grouping indexes constraints schema "
                    "design and performance basics for relational databases."
                ),
            ),
            ProviderRecord(
                provider=self.provider_name,
                provider_resource_id="internal-fastapi-tutorial",
                source_type="internal_curated",
                resource_type="tutorial",
                title="FastAPI Tutorial",
                description="API development tutorial with routing, validation, async endpoints, and docs.",
                source_url="https://fastapi.tiangolo.com/tutorial/",
                language="en",
                level="beginner",
                free_or_paid="free",
                skill_tags=["FastAPI", "Python", "Backend", "REST API"],
                target_roles=["Backend Developer"],
                raw_content=(
                    "FastAPI tutorial teaches path operations request validation pydantic models async "
                    "handlers dependency injection and automatic API documentation."
                ),
                normalized_content=(
                    "FastAPI tutorial teaches path operations request validation pydantic models async "
                    "handlers dependency injection and automatic API documentation."
                ),
            ),
            ProviderRecord(
                provider=self.provider_name,
                provider_resource_id="internal-python-pandas-guide",
                source_type="internal_curated",
                resource_type="tutorial",
                title="Pandas User Guide",
                description="Data analysis guide for DataFrames, cleaning, transformation, and aggregation.",
                source_url="https://pandas.pydata.org/docs/user_guide/index.html",
                language="en",
                level="beginner",
                free_or_paid="free",
                skill_tags=["Python", "Pandas", "Data Analysis"],
                target_roles=["Data Analyst", "Data Scientist"],
                raw_content=(
                    "Pandas user guide explains DataFrames indexing cleaning joins groupby aggregation time "
                    "series handling and practical data analysis workflows."
                ),
                normalized_content=(
                    "Pandas user guide explains DataFrames indexing cleaning joins groupby aggregation time "
                    "series handling and practical data analysis workflows."
                ),
            ),
            ProviderRecord(
                provider=self.provider_name,
                provider_resource_id="internal-scikit-learn-user-guide",
                source_type="internal_curated",
                resource_type="docs",
                title="Scikit-learn User Guide",
                description="Machine learning guide for preprocessing, supervised models, metrics, and pipelines.",
                source_url="https://scikit-learn.org/stable/user_guide.html",
                language="en",
                level="intermediate",
                free_or_paid="free",
                skill_tags=["Machine Learning", "Python", "Scikit-learn"],
                target_roles=["Data Scientist", "ML Engineer"],
                raw_content=(
                    "Scikit-learn user guide covers preprocessing model selection classification regression "
                    "clustering metrics and reusable machine learning pipelines."
                ),
                normalized_content=(
                    "Scikit-learn user guide covers preprocessing model selection classification regression "
                    "clustering metrics and reusable machine learning pipelines."
                ),
            ),
            ProviderRecord(
                provider=self.provider_name,
                provider_resource_id="internal-dbt-fundamentals",
                source_type="internal_curated",
                resource_type="tutorial",
                title="dbt Fundamentals",
                description="Analytics engineering learning path for data modeling, testing, and documentation.",
                source_url="https://docs.getdbt.com/guides/getting-started",
                language="en",
                level="beginner",
                free_or_paid="free",
                skill_tags=["dbt", "SQL", "Data Modeling", "Analytics Engineering"],
                target_roles=["Data Engineer", "Analytics Engineer"],
                raw_content=(
                    "dbt fundamentals introduces transformation models tests documentation lineage and "
                    "modular analytics engineering workflows on warehouse data."
                ),
                normalized_content=(
                    "dbt fundamentals introduces transformation models tests documentation lineage and "
                    "modular analytics engineering workflows on warehouse data."
                ),
            ),
        ]
