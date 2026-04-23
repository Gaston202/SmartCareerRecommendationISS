-- =============================================
-- SEED role_skill_map FROM careers backbone
-- Source of truth:
-- - careers.required_skills      -> core
-- - careers.preferred_interests  -> interest
-- - careers.typical_traits       -> trait
-- =============================================

-- Ensure role_key/skill_name uniqueness stays deterministic
-- role_key format: lower(title) with non-alnum replaced by hyphen
WITH career_base AS (
  SELECT
    c.id AS career_id,
    c.title AS career_title,
    trim(regexp_replace(lower(c.title), '[^a-z0-9]+', '-', 'g')) AS role_key,
    c.required_skills,
    c.preferred_interests,
    c.typical_traits
  FROM careers c
  WHERE c.is_active = TRUE
),
core_skills AS (
  SELECT
    cb.role_key,
    cb.career_id,
    cb.career_title,
    trim(s) AS skill_name,
    'core'::text AS skill_type,
    90 AS priority,
    'careers.required_skills'::text AS evidence_source
  FROM career_base cb
  CROSS JOIN LATERAL unnest(coalesce(cb.required_skills, '{}'::text[])) AS s
  WHERE trim(s) <> ''
),
interest_skills AS (
  SELECT
    cb.role_key,
    cb.career_id,
    cb.career_title,
    trim(s) AS skill_name,
    'interest'::text AS skill_type,
    60 AS priority,
    'careers.preferred_interests'::text AS evidence_source
  FROM career_base cb
  CROSS JOIN LATERAL unnest(coalesce(cb.preferred_interests, '{}'::text[])) AS s
  WHERE trim(s) <> ''
),
trait_skills AS (
  SELECT
    cb.role_key,
    cb.career_id,
    cb.career_title,
    trim(s) AS skill_name,
    'trait'::text AS skill_type,
    50 AS priority,
    'careers.typical_traits'::text AS evidence_source
  FROM career_base cb
  CROSS JOIN LATERAL unnest(coalesce(cb.typical_traits, '{}'::text[])) AS s
  WHERE trim(s) <> ''
),
unioned AS (
  SELECT * FROM core_skills
  UNION ALL
  SELECT * FROM interest_skills
  UNION ALL
  SELECT * FROM trait_skills
),
dedup AS (
  -- Keep highest-priority source if duplicated
  SELECT DISTINCT ON (u.role_key, lower(u.skill_name))
    u.role_key,
    u.career_id,
    u.career_title,
    u.skill_name,
    u.skill_type,
    u.priority,
    u.evidence_source
  FROM unioned u
  ORDER BY u.role_key, lower(u.skill_name), u.priority DESC
)
INSERT INTO role_skill_map (
  role_key,
  career_id,
  career_title,
  skill_name,
  skill_type,
  priority,
  difficulty,
  estimated_duration_hours,
  prerequisites,
  evidence_source,
  metadata,
  is_active
)
SELECT
  d.role_key,
  d.career_id,
  d.career_title,
  d.skill_name,
  d.skill_type,
  d.priority,
  CASE
    WHEN d.skill_type = 'core' THEN 'intermediate'
    WHEN d.skill_type = 'interest' THEN 'beginner'
    ELSE 'beginner'
  END AS difficulty,
  CASE
    WHEN d.skill_type = 'core' THEN 30
    WHEN d.skill_type = 'interest' THEN 16
    ELSE 12
  END AS estimated_duration_hours,
  '{}'::text[] AS prerequisites,
  d.evidence_source,
  jsonb_build_object('seeded_by', '008_seed_role_skill_map', 'seeded_at', now()),
  TRUE
FROM dedup d
ON CONFLICT (role_key, skill_name)
DO UPDATE SET
  career_id = EXCLUDED.career_id,
  career_title = EXCLUDED.career_title,
  skill_type = EXCLUDED.skill_type,
  priority = EXCLUDED.priority,
  difficulty = EXCLUDED.difficulty,
  estimated_duration_hours = EXCLUDED.estimated_duration_hours,
  evidence_source = EXCLUDED.evidence_source,
  metadata = role_skill_map.metadata || jsonb_build_object('reseeded_at', now()),
  is_active = TRUE,
  updated_at = now();

SELECT
  role_key,
  count(*) AS seeded_skills
FROM role_skill_map
GROUP BY role_key
ORDER BY role_key;

