import logging
import io
import re
import asyncio
from typing import Dict, Any, Optional, List
from app.core.database import DatabaseService
from app.core.ai_orchestrator import AIOrchestratorService
from app.core.cache import CacheService
from app.core.config import settings

logger = logging.getLogger(__name__)


class CvService:
    """
    CV service for PDF upload and AI analysis.
    Equivalent to NestJS CvService.
    """

    def __init__(
        self,
        db: DatabaseService,
        ai_orchestrator: AIOrchestratorService,
        cache_service: CacheService,
    ):
        self.db = db
        self.ai_orchestrator = ai_orchestrator
        self.cache_service = cache_service
        self._background_tasks: Dict[str, asyncio.Task] = {}

    def _response_data(self, response: Any) -> Any:
        return response.data if response is not None and hasattr(response, 'data') else None

    def _extract_missing_column_from_error(self, error: Exception) -> Optional[str]:
        """
        Parse PostgREST schema-cache errors and return the missing column name when present.
        Example message: Could not find the 'summary' column of 'cv_analysis' in the schema cache
        """
        try:
            payload = error.args[0] if getattr(error, 'args', None) else None
            message = ''
            if isinstance(payload, dict):
                message = str(payload.get('message') or '')
            else:
                message = str(error)

            match = re.search(r"Could not find the '([^']+)' column", message)
            if match:
                return match.group(1)
        except Exception:
            return None
        return None

    async def _update_cv_analysis_with_schema_fallback(self, analysis_id: str, update_data: Dict[str, Any]) -> None:
        """
        Update cv_analysis while gracefully handling schema drift.
        If PostgREST reports unknown columns, remove only those columns and retry.
        """
        safe_update = dict(update_data)

        for _ in range(len(update_data) + 1):
            try:
                update_res = await self.db.get_client().from_('cv_analysis').update(safe_update).eq('id', analysis_id).execute()
                if getattr(update_res, 'error', None):
                    raise ValueError(f'Failed to persist CV analysis: {update_res.error}')
                return
            except Exception as e:
                missing_column = self._extract_missing_column_from_error(e)
                if missing_column and missing_column in safe_update and missing_column != 'status':
                    logger.warning(
                        f"cv_analysis missing column '{missing_column}', retrying without it"
                    )
                    safe_update.pop(missing_column, None)
                    continue
                raise

        raise ValueError('Failed to persist CV analysis after schema fallback retries')

    async def upload_cv(self, user_id: str, file: Any) -> Dict[str, Any]:
        """
        Upload CV PDF and start analysis.
        Returns immediately - analysis runs in background.
        """
        try:
            # Read PDF content
            content = await self._read_pdf_content(file)
            if not content:
                raise ValueError('Could not extract text from PDF')

            # Create cvs record first to get cv_upload_id
            import uuid
            cv_insert = await self.db.get_client().from_('cvs').insert({
                'user_id': user_id,
                'filename': getattr(file, 'filename', 'cv.pdf'),
                'mime_type': 'application/pdf',
                'storage_path': f'cvs/{user_id}/{getattr(file, "filename", "cv.pdf")}',
                'status': 'uploaded',
            }).execute()
            
            if not cv_insert.data or len(cv_insert.data) == 0:
                raise ValueError('CV upload record could not be created')
            cv_upload_id = cv_insert.data[0]['id']

            # Create CV analysis record with 'processing' status
            # The actual AI analysis will run after response is sent
            result = await self.db.get_client().from_('cv_analysis').insert({
                'user_id': user_id,
                'cv_upload_id': cv_upload_id,
                'status': 'processing',
            }).execute()

            if not result.data or len(result.data) == 0:
                raise ValueError('CV analysis record could not be created')
            analysis = result.data[0]
            analysis_id = analysis['id']

            # Run analysis in background
            async def run_analysis(analysis_id: str, content: str):
                try:
                    await self._process_cv_analysis(analysis_id, content)
                except Exception as e:
                    logger.error(f"CV analysis failed: {e}")
                    try:
                        await self._update_cv_analysis_with_schema_fallback(
                            analysis_id, {'status': 'failed', 'extracted_text': f'Analysis failed: {e}'}
                        )
                    except Exception:
                        pass
            
            task = asyncio.create_task(run_analysis(analysis_id, content))
            self._background_tasks[analysis_id] = task
            task.add_done_callback(lambda t: self._background_tasks.pop(analysis_id, None))

            return {
                'id': analysis_id,
                'status': 'processing',
                'message': 'CV uploaded. Analysis in progress.',
            }
        except Exception as e:
            logger.exception('Failed to upload CV')
            raise ValueError(f'Failed to upload CV: {str(e)}')

    async def get_latest_analysis(self, user_id: str) -> Optional[Dict[str, Any]]:
        """
        Get latest CV analysis for user.
        Equivalent to NestJS CvService.getLatestAnalysis.
        """
        result = await self.db.get_client().from_('cv_analysis').select('*').eq('user_id', user_id).order('created_at', desc=True).limit(1).maybe_single().execute()
        row = self._response_data(result)
        if row:
            await self._auto_fail_stale_processing(row)
            # refetch if we changed status
            if row.get('status') == 'processing':
                refreshed = await self.db.get_client().from_('cv_analysis').select('*').eq('id', row['id']).maybe_single().execute()
                return self._response_data(refreshed) or row
        return row

    async def get_analysis(self, user_id: str, analysis_id: str) -> Optional[Dict[str, Any]]:
        """
        Get CV analysis result by ID.
        Equivalent to NestJS CvService.getAnalysis.
        """
        result = await self.db.get_client().from_('cv_analysis').select('*').eq('id', analysis_id).eq('user_id', user_id).single().execute()
        row = self._response_data(result)
        if row:
            await self._auto_fail_stale_processing(row)
            if row.get('status') == 'processing':
                refreshed = await self.db.get_client().from_('cv_analysis').select('*').eq('id', row['id']).maybe_single().execute()
                return self._response_data(refreshed) or row
        return row

    async def _auto_fail_stale_processing(self, row: Dict[str, Any], max_age_seconds: int = 600) -> None:
        """
        Safety net: if a CV analysis is stuck in 'processing' for too long, mark it as failed.
        Prevents the mobile app from waiting forever.
        """
        try:
            if row.get('status') != 'processing':
                return

            from datetime import datetime, timezone

            updated_at = row.get('updated_at') or row.get('created_at')
            if not updated_at or not isinstance(updated_at, str):
                return

            # Handle common ISO formats (with or without Z)
            iso = updated_at.replace('Z', '+00:00')
            dt = datetime.fromisoformat(iso)
            if dt.tzinfo is None:
                dt = dt.replace(tzinfo=timezone.utc)

            age = (datetime.now(timezone.utc) - dt).total_seconds()
            if age <= max_age_seconds:
                return

            msg = 'CV analysis exceeded time limit and was marked as failed. Please re-upload your CV.'
            await self.db.get_client().from_('cv_analysis').update({
                'status': 'failed',
                'error_message': msg,
            }).eq('id', row['id']).execute()
        except Exception:
            # Never break normal status requests
            return

    async def _read_pdf_content(self, file: Any) -> str:
        """Extract text content from PDF file using PyPDF2."""
        try:
            import PyPDF2

            try:
                underlying = getattr(file, 'file', None)
                if underlying and hasattr(underlying, 'seek'):
                    underlying.seek(0)
            except Exception:
                pass

            if hasattr(file, 'read'):
                content = await file.read()
                from io import BytesIO
                file_obj = BytesIO(content)
                reader = PyPDF2.PdfReader(file_obj)
            else:
                reader = PyPDF2.PdfReader(file)

            text = ''
            for page in reader.pages:
                page_text = page.extract_text()
                if page_text:
                    text += page_text + '\n'

            return text.strip()
        except Exception as e:
            logger.error(f'PyPDF2 extraction failed: {e}')
            raise ValueError('Could not extract text from PDF. Please ensure the file is a valid PDF.')

    async def _process_cv_analysis(self, analysis_id: str, pdf_text: str) -> None:
        """
        Process CV analysis using AI.
        """
        try:
            analysis_result = await self.ai_orchestrator.analyze_cv(pdf_text)
            
            extracted_skills = analysis_result.get('skills', [])
            extracted_interests = analysis_result.get('interests', [])
            summary = analysis_result.get('summary', '')
            ats_score = analysis_result.get('ats_score', 0)
            ats_issues = analysis_result.get('ats_issues', [])
            suggested_improvements = analysis_result.get('suggested_improvements', [])
            career_suggestions = analysis_result.get('career_suggestions', [])

            # Update analysis record with all fields
            update_data = {
                'status': 'completed',
                'extracted_skills': extracted_skills,
                'extracted_interests': extracted_interests,
                'extracted_text': summary,
                'ats_score': ats_score,
                'ats_issues': ats_issues,
                'suggested_improvements': suggested_improvements,
                'career_suggestions': career_suggestions,
                # Avoid PostgREST trying to coerce 'now()' string; let DB default/update trigger if present.
            }

            await self._update_cv_analysis_with_schema_fallback(analysis_id, update_data)

            # Invalidate related caches
            await self.cache_service.invalidate_pattern(f'cv:analysis:*')
            await self.cache_service.invalidate_pattern(f'career:matches:*')

        except Exception as e:
            logger.error(f'CV analysis processing failed for {analysis_id}: {e}')
            await self.db.get_client().from_('cv_analysis').update({
                'status': 'failed',
                'error_message': str(e),
            }).eq('id', analysis_id).execute()
            raise

    def _split_text_into_snippets(self, text: str, max_length: int = 500) -> List[str]:
        """
        Split text into snippets for AI processing.
        """
        # Clean text
        text = re.sub(r'\s+', ' ', text)

        snippets = []
        words = text.split()
        current_snippet = []
        current_length = 0

        for word in words:
            current_snippet.append(word)
            current_length += len(word) + 1

            if current_length >= max_length:
                snippets.append(' '.join(current_snippet))
                current_snippet = []
                current_length = 0

        if current_snippet:
            snippets.append(' '.join(current_snippet))

        return snippets[:10]  # Limit to 10 snippets

    async def generate_cv_suggestions(self, cv_text: str, ats_score: float) -> Dict[str, Any]:
        """
        Generate CV improvement suggestions.
        Equivalent to NestJS CvService.generateCvSuggestions.
        """
        try:
            cache_key = f'cv:suggestions:{hash(cv_text[:500])}:{ats_score}'
            cached = await self.cache_service.get(cache_key)
            if cached:
                return cached

            # This would call AI in the full implementation
            suggestions = {
                'ats_issues': [],
                'suggested_improvements': [
                    'Add more specific achievements with metrics',
                    'Include relevant keywords for your target role',
                    'Format dates consistently throughout the document',
                ],
            }

            await self.cache_service.set(cache_key, suggestions, 86400)
            return suggestions
        except Exception as e:
            logger.error('Failed to generate CV suggestions', e)
            return {'ats_issues': [], 'suggested_improvements': []}

    async def delete_cv(self, user_id: str, upload_id: str) -> Dict[str, Any]:
        """
        Delete CV upload and all associated data.
        Deletes cv_analysis records, career_match_results, and storage file.
        """
        try:
            # First get the CV record to find storage_path
            cv_record = await self.db.get_client().from_('cvs').select('storage_path').eq('id', upload_id).eq('user_id', user_id).maybe_single().execute()
            storage_path = cv_record.data.get('storage_path') if cv_record and cv_record.data else None

            # 1. Get cv_analysis records associated with this CV
            analyses = await self.db.get_client().from_('cv_analysis').select('id').eq('cv_upload_id', upload_id).eq('user_id', user_id).execute()

            # 2. Delete career_match_results that reference these cv_analysis records
            if analyses.data and len(analyses.data) > 0:
                analysis_ids = [a['id'] for a in analyses.data]
                await self.db.get_client().from_('career_match_results').delete().in_('cv_analysis_id', analysis_ids).execute()

            # 3. Delete cv_analysis records
            await self.db.get_client().from_('cv_analysis').delete().eq('cv_upload_id', upload_id).eq('user_id', user_id).execute()

            # 4. Delete CV record
            await self.db.get_client().from_('cvs').delete().eq('id', upload_id).eq('user_id', user_id).execute()

            # 5. Delete file from storage
            if storage_path:
                try:
                    await self.db.get_client().storage.from_('cvs_debug').remove([storage_path])
                except Exception as storage_error:
                    logger.warning(f'Failed to delete storage file {storage_path}: {storage_error}')

            # Invalidate caches
            await self.cache_service.invalidate_pattern(f'cv:analysis:*')
            await self.cache_service.invalidate_pattern(f'career:matches:*')

            return {'deleted': True, 'upload_id': upload_id}
        except Exception as e:
            logger.exception('Failed to delete CV')
            raise ValueError(f'Failed to delete CV: {str(e)}')

    async def analyze_cv(self, pdf_text: str) -> Dict[str, Any]:
        """
        Analyze CV text and extract structured information.
        Equivalent to NestJS AiOrchestratorService.analyzeCv.
        """
        try:
            # Extract text snippets
            snippets = self._split_text_into_snippets(pdf_text)

            if not snippets:
                return {
                    'skills': [],
                    'experience': [],
                    'education': [],
                    'summary': 'Could not analyze CV',
                }

            # Use AI for analysis (placeholder for now)
            # In full implementation, this would call the AI orchestrator
            return {
                'skills': self._extract_skills_from_text(pdf_text),
                'experience': self._extract_experience_from_text(pdf_text),
                'education': self._extract_education_from_text(pdf_text),
                'summary': self._generate_summary(pdf_text),
            }
        except Exception as e:
            logger.error('CV analysis failed', e)
            return {
                'skills': [],
                'experience': [],
                'education': [],
                'summary': 'Could not analyze CV',
            }

    def _extract_skills_from_text(self, text: str) -> List[str]:
        """Extract skills from text using keyword matching."""
        common_skills = [
            'Python', 'JavaScript', 'Java', 'C++', 'SQL', 'NoSQL', 'MongoDB', 'PostgreSQL',
            'React', 'Vue', 'Angular', 'Node.js', 'Django', 'Flask', 'FastAPI',
            'AWS', 'Azure', 'GCP', 'Docker', 'Kubernetes', 'CI/CD',
            'Machine Learning', 'Deep Learning', 'NLP', 'Data Analysis', 'Statistics',
            'Project Management', 'Agile', 'Scrum', 'Leadership', 'Communication',
            'Teamwork', 'Problem Solving', 'Critical Thinking', 'Time Management',
        ]

        text_lower = text.lower()
        found_skills = []

        for skill in common_skills:
            if skill.lower() in text_lower:
                found_skills.append(skill)

        return found_skills[:20]  # Return top 20 skills

    def _extract_experience_from_text(self, text: str) -> List[Dict[str, Any]]:
        """Extract work experience from text."""
        # Simple regex-based extraction
        experience_pattern = r'(?:work experience|experience|employment|worked as|position).*?(?=\n\n|\Z)'
        matches = re.findall(experience_pattern, text, re.IGNORECASE | re.DOTALL)

        experiences = []
        for match in matches[:5]:  # Limit to 5 experiences
            experiences.append({
                'title': 'Work Experience',
                'description': match[:200] + '...' if len(match) > 200 else match,
            })

        return experiences

    def _extract_education_from_text(self, text: str) -> List[Dict[str, Any]]:
        """Extract education from text."""
        education_keywords = ['bachelor', 'master', 'phd', 'degree', 'university', 'college', 'school']

        lines = text.split('\n')
        education = []

        for line in lines:
            if any(keyword in line.lower() for keyword in education_keywords):
                education.append({
                    'degree': 'Degree',
                    'institution': line[:100],
                    'year': None,
                })

        return education[:3]  # Limit to 3 education entries

    def _generate_summary(self, text: str) -> str:
        """Generate a summary from CV text."""
        # Extract first substantial paragraph
        paragraphs = [p.strip() for p in text.split('\n\n') if len(p.strip()) > 50]

        if paragraphs:
            summary = paragraphs[0][:300]
            if len(paragraphs[0]) > 300:
                summary += '...'
            return summary

        return 'Professional with experience in various domains.'