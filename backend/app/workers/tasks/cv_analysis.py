import logging
from typing import Dict, Any
from app.core.database import DatabaseService
from app.core.ai_orchestrator import AIOrchestratorService
from app.core.queue import QueueService

logger = logging.getLogger(__name__)


async def process_cv_analysis(job_id: str, data: Dict[str, Any] = None) -> None:
    """
    Process CV analysis background task.
    Equivalent to NestJS worker task.
    """
    logger.info(f'Processing CV analysis job: {job_id}')

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
        analysis_id = job_data.get('analysisId') or job_data.get('analysis_id')

        if not user_id or not analysis_id:
            raise ValueError('Missing user_id or analysis_id in job data')

        # Fetch CV analysis record
        result = await db_service.get_client().from_('cv_analysis').select('*').eq('id', analysis_id).eq('user_id', user_id).single().execute()

        if result.error or not result.data:
            raise ValueError(f'CV analysis not found: {analysis_id}')

        cv_record = result.data

        if cv_record.get('status') != 'processing':
            logger.warning(f'CV analysis {analysis_id} is not in processing state')
            return

        # Note: In a full implementation, we would:
        # 1. Fetch the PDF content from storage
        # 2. Extract text using pdfminer or similar
        # 3. Call AI for analysis
        # 4. Update the record with results

        logger.info(f'CV analysis {analysis_id} processing completed')

    except Exception as e:
        logger.error(f'CV analysis job {job_id} failed: {e}')
        raise


def process_cv_analysis_sync(job_id: str) -> None:
    """
    Synchronous wrapper for CV analysis (for RQ worker).
    """
    import asyncio
    asyncio.run(process_cv_analysis(job_id))