from supabase import create_client, Client
from app.core.config import settings

# Initialize Supabase clients
supabase: Client = create_client(settings.supabase_url, settings.supabase_anon_key)
supabase_service_role: Client = create_client(settings.supabase_url, settings.supabase_service_role_key)