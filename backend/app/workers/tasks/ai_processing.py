import logging
from typing import Dict, Any
from app.core.database import DatabaseService
from app.core.ai_orchestrator import AIOrchestratorService
from app.core.queue import QueueService

logger = logging.getLogger(__name__)


async def process_ai_task(job_id: str, data: Dict[str, Any] = None) -> None:
    """
    Process AI task background job.
    Equivalent to NestJS worker task.
    """
    logger.info(f'Processing AI task: {job_id}')

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
        task_type = job_data.get('taskType') or job_data.get('task_type', 'unknown')

        logger.info(f'AI task type: {task_type}')

        # Process based on task type
        if task_type == 'generate-careers':
            await _process_generate_careers(job_id, job_data, ai_service)
        elif task_type == 'personalize-roadmap':
            await _process_personalize_roadmap(job_id, job_data, ai_service)
        elif task_type == 'generate-quiz':
            await _process_generate_quiz(job_id, job_data, ai_service)
        else:
            logger.warning(f'Unknown AI task type: {task_type}')

    except Exception as e:
        logger.error(f'AI task {job_id} failed: {e}')
        raise


async def _process_generate_careers(job_id: str, data: Dict[str, Any], ai_service: AIOrchestratorService) -> None:
    """Process generate careers AI task."""
    profile_data = data.get('profile', {})
    logger.info(f'Generating careers for profile')

    # Call AI to generate careers
    careers = await ai_service.generate_careers_from_profile(profile_data)
    logger.info(f'Generated {len(careers)} careers')


def process_ai_task_sync(job_id: str) -> None:
    """
    Synchronous wrapper for AI task (for RQ worker).
    """
    import asyncio
    asyncio.run(process_ai_task(job_id))


# Additional task handlers
async def _process_personalize_roadmap(job_id: str, data: Dict[str, Any], ai_service: AIOrchestratorService) -> None:
    """Process roadmap personalization task."""
    logger.info(f'Personalizing roadmap for job {job_id}')
    # Implementation would call AI for roadmap personalization
    pass


async def _process_generate_quiz(job_id: str, data: Dict[str, Any], ai_service: AIOrchestratorService) -> None:
    """Process quiz generation task."""
    logger.info(f'Generating quiz for job {job_id}')
    # Implementation would call AI for quiz generation
    pass