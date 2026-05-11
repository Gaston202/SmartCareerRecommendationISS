from datetime import datetime
import logging
from typing import Dict, Any
from app.core.database import DatabaseService
from app.core.ai_orchestrator import AIOrchestratorService
from app.core.queue import QueueService

logger = logging.getLogger(__name__)


async def process_roadmap_generation(job_id: str, data: Dict[str, Any] = None) -> None:
    """
    Process roadmap generation background task.
    Equivalent to NestJS worker task for roadmap generation.
    """
    logger.info(f'Processing roadmap generation job: {job_id}')

    try:
        # Initialize services
        db_service = DatabaseService()
        ai_service = AIOrchestratorService()
        queue_service = QueueService()

        # Get job details
        job = await queue_service.get_job_status(job_id)
        if not job:
            raise ValueError(f'Job not found: {job_id}')

        job_data = job.get('data', {}) or (data or {})
        user_id = job_data.get('userId') or job_data.get('user_id')
        career_id = job_data.get('careerId') or job_data.get('career_id')
        user_profile = job_data.get('userProfile') or job_data.get('user_profile', {})

        if not user_id or not career_id:
            raise ValueError('Missing user_id or career_id in job data')

        logger.info(f'Generating roadmap for user={user_id}, career={career_id}')

        # Fetch base roadmap template
        result = await db_service.get_client().from_('career_roadmaps').select('*').eq('career_id', career_id).single().execute()

        if result.error or not result.data:
            raise ValueError(f'No roadmap template found for career {career_id}')

        base_roadmap = result.data
        milestones = base_roadmap.get('milestones', [])

        # Personalize if user profile provided
        if user_profile:
            logger.info(f'Personalizing roadmap with user profile')
            try:
                personalized = await ai_service.personalize_roadmap(
                    base_roadmap,
                    user_profile.get('skills', []),
                    user_profile.get('novaProfile', {}),
                    user_profile.get('cvSummary', ''),
                )
                milestones = personalized.get('personalizedMilestones', milestones)
            except Exception as e:
                logger.warning(f'Roadmap personalization failed: {e}, using base milestones')

        # Calculate total duration
        total_duration = sum(m.get('duration_weeks', 0) for m in milestones)

        # Create personalized roadmap
        personalized_roadmap = {
            'id': base_roadmap['id'],
            'user_id': user_id,
            'career_id': career_id,
            'title': base_roadmap['title'],
            'description': base_roadmap['description'],
            'milestones': milestones,
            'total_duration_weeks': total_duration,
            'personalized': bool(user_profile),
            'generated_at': datetime.utcnow().isoformat(),
        }

        # Save to user_roadmaps table (if it exists)
        try:
            await db_service.get_client().from_('user_roadmaps').insert({
                'user_id': user_id,
                'career_id': career_id,
                'roadmap_data': personalized_roadmap,
                'generated_at': datetime.utcnow().isoformat(),
            }).execute()
        except Exception as e:
            logger.warning(f'Could not save roadmap to user_roadmaps: {e}')

        logger.info(f'Roadmap generation completed for job {job_id}')

    except Exception as e:
        logger.error(f'Roadmap generation job {job_id} failed: {e}')
        raise


def process_roadmap_generation_sync(job_id: str) -> None:
    """
    Synchronous wrapper for roadmap generation (for RQ worker).
    """
    import asyncio
    asyncio.run(process_roadmap_generation(job_id))