from app.ingestion.providers.coursera import CourseraProvider
from app.ingestion.providers.web import WebProvider
from app.ingestion.providers.youtube import YouTubeProvider


def get_provider(name: str):
    providers = {
        "coursera": CourseraProvider,
        "web": WebProvider,
        "youtube": YouTubeProvider,
    }
    provider_cls = providers.get((name or "").lower(), WebProvider)
    return provider_cls()
