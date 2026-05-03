import argparse
import asyncio
import sys
from pathlib import Path
from typing import Dict, List


ROOT = Path(__file__).resolve().parents[1]
if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))

from app.core.database import DatabaseService
from app.ingestion.pipeline import run_ingestion


SEED_RESOURCES: Dict[str, List[str]] = {
    "python": [
        "https://docs.python.org/3/tutorial/",
        "https://docs.python.org/3/library/",
        "https://realpython.com/python-basics/",
    ],
    "fastapi": [
        "https://fastapi.tiangolo.com/tutorial/",
        "https://fastapi.tiangolo.com/tutorial/sql-databases/",
        "https://fastapi.tiangolo.com/deployment/",
    ],
    "postgresql": [
        "https://www.postgresql.org/docs/current/tutorial.html",
        "https://www.postgresql.org/docs/current/sql.html",
        "https://www.postgresqltutorial.com/",
    ],
    "docker": [
        "https://docs.docker.com/get-started/",
        "https://docs.docker.com/reference/dockerfile/",
        "https://docs.docker.com/compose/",
    ],
    "redis": [
        "https://redis.io/docs/latest/develop/",
        "https://redis.io/docs/latest/develop/clients/redis-py/",
        "https://redis.io/docs/latest/develop/use/",
    ],
    "celery": [
        "https://docs.celeryq.dev/en/stable/getting-started/introduction.html",
        "https://docs.celeryq.dev/en/stable/getting-started/first-steps-with-celery.html",
        "https://docs.celeryq.dev/en/stable/userguide/tasks.html",
    ],
    "system_design": [
        "https://github.com/donnemartin/system-design-primer",
        "https://microservices.io/patterns/index.html",
        "https://12factor.net/",
    ],
    "testing": [
        "https://docs.pytest.org/en/stable/getting-started.html",
        "https://fastapi.tiangolo.com/tutorial/testing/",
        "https://docs.python.org/3/library/unittest.html",
    ],
    "git": [
        "https://git-scm.com/book/en/v2",
        "https://docs.github.com/en/get-started/using-git/about-git",
        "https://docs.github.com/en/pull-requests",
    ],
    "javascript": [
        "https://developer.mozilla.org/en-US/docs/Web/JavaScript/Guide",
        "https://javascript.info/",
        "https://developer.mozilla.org/en-US/docs/Learn_web_development/Core/Scripting",
    ],
    "typescript": [
        "https://www.typescriptlang.org/docs/handbook/intro.html",
        "https://www.typescriptlang.org/docs/handbook/2/basic-types.html",
        "https://www.typescriptlang.org/tsconfig/",
    ],
    "react": [
        "https://react.dev/learn",
        "https://react.dev/reference/react",
        "https://react.dev/learn/thinking-in-react",
    ],
    "css": [
        "https://developer.mozilla.org/en-US/docs/Learn_web_development/Core/Styling_basics",
        "https://web.dev/learn/css",
        "https://developer.mozilla.org/en-US/docs/Web/CSS/Layout_cookbook",
    ],
    "html": [
        "https://developer.mozilla.org/en-US/docs/Learn_web_development/Core/Structuring_content",
        "https://web.dev/learn/html",
        "https://developer.mozilla.org/en-US/docs/Web/HTML/Reference",
    ],
    "nextjs": [
        "https://nextjs.org/docs",
        "https://nextjs.org/learn",
        "https://nextjs.org/docs/app/getting-started/project-structure",
    ],
    "performance": [
        "https://web.dev/learn/performance",
        "https://developer.mozilla.org/en-US/docs/Web/Performance",
        "https://web.dev/explore/fast",
    ],
    "accessibility": [
        "https://developer.mozilla.org/en-US/docs/Web/Accessibility",
        "https://web.dev/learn/accessibility",
        "https://www.w3.org/WAI/fundamentals/accessibility-intro/",
    ],
    "pandas": [
        "https://pandas.pydata.org/docs/getting_started/intro_tutorials/",
        "https://pandas.pydata.org/docs/user_guide/index.html",
        "https://pandas.pydata.org/docs/reference/index.html",
    ],
    "numpy": [
        "https://numpy.org/doc/stable/user/absolute_beginners.html",
        "https://numpy.org/doc/stable/user/quickstart.html",
        "https://numpy.org/doc/stable/reference/",
    ],
    "sql": [
        "https://www.postgresql.org/docs/current/tutorial-sql.html",
        "https://mode.com/sql-tutorial/",
        "https://www.sqlite.org/lang.html",
    ],
    "machine_learning": [
        "https://scikit-learn.org/stable/getting_started.html",
        "https://scikit-learn.org/stable/user_guide.html",
        "https://developers.google.com/machine-learning/crash-course",
    ],
    "deep_learning": [
        "https://pytorch.org/tutorials/beginner/basics/intro.html",
        "https://www.tensorflow.org/guide",
        "https://www.deeplearningbook.org/",
    ],
    "mlops": [
        "https://mlflow.org/docs/latest/index.html",
        "https://www.tensorflow.org/tfx/guide",
        "https://cloud.google.com/architecture/mlops-continuous-delivery-and-automation-pipelines-in-machine-learning",
    ],
    "data_visualization": [
        "https://matplotlib.org/stable/tutorials/index.html",
        "https://seaborn.pydata.org/tutorial.html",
        "https://plotly.com/python/getting-started/",
    ],
    "statistics": [
        "https://openstax.org/details/books/introductory-statistics",
        "https://www.khanacademy.org/math/statistics-probability",
        "https://www.itl.nist.gov/div898/handbook/",
    ],
}


COURSE_RESOURCE_URLS: Dict[str, List[str]] = {
    "python": [
        "https://www.youtube.com/watch?v=rfscVS0vtbw",
        "https://developers.google.com/edu/python",
        "https://www.coursera.org/specializations/python",
        "https://www.freecodecamp.org/learn/scientific-computing-with-python/",
    ],
    "fastapi": [
        "https://www.youtube.com/watch?v=7t2alSnE2-I",
        "https://www.coursera.org/projects/create-your-first-web-api-with-python-and-fastapi",
        "https://www.udemy.com/course/fastapi-the-complete-course/",
    ],
    "postgresql": [
        "https://www.youtube.com/watch?v=qw--VYLpxG4",
        "https://www.coursera.org/learn/introduction-to-relational-databases",
        "https://cloud.google.com/learn/training/data-engineering-and-analytics",
    ],
    "docker": [
        "https://www.youtube.com/watch?v=pg19Z8LL06w",
        "https://training.linuxfoundation.org/certification/docker-certified-associate-dca/",
        "https://www.coursera.org/learn/ibm-containers-docker-kubernetes-openshift",
    ],
    "redis": [
        "https://www.youtube.com/watch?v=Hbt56gFj998",
        "https://university.redis.io/",
        "https://redis.io/docs/latest/develop/clients/redis-py/",
    ],
    "celery": [
        "https://www.youtube.com/watch?v=THxCy-6EnQM",
        "https://testdriven.io/courses/django-celery/",
        "https://docs.celeryq.dev/en/stable/getting-started/first-steps-with-celery.html",
    ],
    "system_design": [
        "https://www.youtube.com/watch?v=F2FmTdLtb_4",
        "https://www.coursera.org/learn/system-design-interview",
        "https://www.educative.io/courses/grokking-modern-system-design-interview-for-engineers-managers",
    ],
    "testing": [
        "https://www.youtube.com/watch?v=cHYq1MRoyI0",
        "https://testautomationu.applitools.com/",
        "https://www.coursera.org/learn/introduction-software-testing",
    ],
    "git": [
        "https://www.youtube.com/watch?v=RGOj5yH7evk",
        "https://www.coursera.org/learn/introduction-git-github",
        "https://learn.microsoft.com/en-us/training/modules/intro-to-git/",
    ],
    "javascript": [
        "https://www.youtube.com/watch?v=PkZNo7MFNFg",
        "https://web.dev/learn/javascript",
        "https://www.freecodecamp.org/learn/javascript-algorithms-and-data-structures-v8/",
    ],
    "typescript": [
        "https://www.youtube.com/watch?v=30LWjhZzg50",
        "https://www.coursera.org/projects/introduction-to-typescript",
        "https://learn.microsoft.com/en-us/training/paths/build-javascript-applications-typescript/",
    ],
    "react": [
        "https://www.youtube.com/watch?v=bMknfKXIFA8",
        "https://www.coursera.org/learn/react-basics",
        "https://www.freecodecamp.org/learn/front-end-development-libraries/",
    ],
    "css": [
        "https://www.youtube.com/watch?v=OXGznpKZ_sA",
        "https://web.dev/learn/css",
        "https://www.freecodecamp.org/learn/2022/responsive-web-design/",
    ],
    "machine_learning": [
        "https://developers.google.com/machine-learning/crash-course",
        "https://www.youtube.com/watch?v=i_LwzRVP7bg",
        "https://www.coursera.org/learn/machine-learning",
    ],
    "mlops": [
        "https://cloud.google.com/learn/training/machinelearning-ai",
        "https://www.youtube.com/watch?v=9BgIDqAzfuA",
        "https://www.coursera.org/specializations/machine-learning-engineering-for-production-mlops",
    ],
}

for skill, urls in COURSE_RESOURCE_URLS.items():
    SEED_RESOURCES.setdefault(skill, [])
    SEED_RESOURCES[skill] = list(dict.fromkeys(SEED_RESOURCES[skill] + urls))


async def main() -> None:
    args = parse_args()
    selected = args.skills or sorted(SEED_RESOURCES.keys())
    db = await DatabaseService.create()

    queued_jobs = []
    for skill in selected:
        urls = SEED_RESOURCES.get(skill)
        if not urls:
            print(f"Skipping unknown skill: {skill}")
            continue

        for url in urls[: args.limit_per_skill]:
            job = await create_job(db, skill, url, args.target_role)
            queued_jobs.append(job)
            print(f"Queued {skill}: {url} -> {job.get('id')}")

            if args.run_now and job.get("id"):
                try:
                    result = await run_ingestion(job["id"])
                    print(f"  ingested: {result}")
                except Exception as exc:
                    print(f"  failed: {exc}")

    print(f"Queued {len(queued_jobs)} ingestion jobs")


async def create_job(db: DatabaseService, skill: str, url: str, target_role: str) -> dict:
    result = (
        await db.get_client()
        .from_("ingestion_jobs")
        .insert(
            {
                "provider": "web",
                "job_type": "on_demand_refresh",
                "status": "pending",
                "requested_by": None,
                "trigger_reason": "rag seed resource",
                "filters": {
                    "urls": [url],
                    "skill_tags": [skill],
                    "target_roles": [target_role],
                },
                "stats": {},
            }
        )
        .execute()
    )
    rows = result.data or []
    return rows[0] if rows else {}


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Seed roadmap RAG resources")
    parser.add_argument("--skills", nargs="*", help="Specific skills to seed")
    parser.add_argument("--target-role", default="backend_developer")
    parser.add_argument("--limit-per-skill", type=int, default=3)
    parser.add_argument("--run-now", action="store_true", help="Run ingestion immediately after queuing")
    return parser.parse_args()


if __name__ == "__main__":
    asyncio.run(main())
