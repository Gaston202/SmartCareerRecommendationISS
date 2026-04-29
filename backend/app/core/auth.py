from typing import Optional, Dict, Any
from supabase import Client
from app.core.database import DatabaseService
import logging
from fastapi import HTTPException, status

logger = logging.getLogger(__name__)


class AuthService:
    """
    Auth service for Supabase JWT validation and user profile management.
    Equivalent to NestJS AuthService.
    """

    def __init__(self, db_service: DatabaseService):
        self.db = db_service

    async def validate_user_from_supabase(self, token: str) -> Dict[str, Any]:
        """
        Validate a Supabase JWT token and return user data.
        Equivalent to NestJS AuthService.validateUserFromSupabase.
        """
        try:
            logger.info(f"Validating token with Supabase (token length: {len(token)})")
            response = await self.db.get_anon_client().auth.get_user(token)

            error = getattr(response, 'error', None)
            if error:
                logger.warning('Supabase token validation error:', {
                    'message': getattr(error, 'message', str(error)),
                    'status': getattr(error, 'status', None),
                    'code': getattr(error, 'code', None),
                })
                raise ValueError('Invalid or expired token')

            # Handle various Supabase response structures
            user = getattr(response, 'user', None)
            if user is None:
                data = getattr(response, 'data', None)
                if data:
                    user = getattr(data, 'user', None)

            if not user:
                logger.warning('No user returned from Supabase for token')
                raise ValueError('Invalid or expired token')

            logger.info(f'Token valid for user: {user.id}, email: {user.email}')

            return {
                'id': user.id,
                'email': user.email,
                'aud': user.aud,
                'role': user.role,
                'email_confirmed_at': user.email_confirmed_at,
                'created_at': user.created_at,
            }
        except ValueError:
            raise
        except Exception as e:
            logger.warning('Token validation failed', {
                'error': str(e),
                'error_type': type(e).__name__,
            })
            raise ValueError('Token validation failed')

    async def get_user_profile(self, user_id: str) -> Optional[Dict[str, Any]]:
        """
        Get user profile from user_profiles table.
        Equivalent to NestJS AuthService.getUserProfile.
        """
        try:
            response = await self.db.get_client().from_('user_profiles').select('*').eq('user_id', user_id).single().execute()

            if response.error and response.error.code != 'PGRST116':  # PGRST116 means no rows returned
                raise response.error

            return response.data
        except Exception as e:
            logger.error('Failed to fetch user profile', e)
            return None

    async def create_or_update_user_profile(self, user_id: str, profile_data: Dict[str, Any]) -> Dict[str, Any]:
        """
        Create or update user profile.
        Equivalent to NestJS AuthService.createOrUpdateUserProfile.
        """
        try:
            upsert_data = {
                'user_id': user_id,
                **profile_data,
                'updated_at': 'now()',  # Supabase will handle the timestamp
            }

            response = await self.db.get_client().from_('user_profiles').upsert(upsert_data).select().single().execute()

            if response.error:
                raise response.error

            return response.data
        except Exception as e:
            logger.error('Failed to upsert user profile', e)
            raise e