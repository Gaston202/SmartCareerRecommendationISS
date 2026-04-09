-- =============================================
-- DATA MIGRATION: Populate new columns in careers table
-- Based on your existing data
-- =============================================

-- 1. Populate tags from category and demand_level
UPDATE careers
SET tags = ARRAY[
  COALESCE(category, 'General'),
  COALESCE(demand_level || ' Demand', 'Unknown Demand')
]
WHERE tags IS NULL OR array_length(tags, 1) = 0;

-- 2. Populate salary ranges from average_salary (assuming average_salary is annual)
UPDATE careers
SET
  salary_range_min = GREATEST(average_salary * 0.9, 0)::INTEGER,
  salary_range_max = GREATEST(average_salary * 1.1, 0)::INTEGER
WHERE salary_range_min IS NULL OR salary_range_max IS NULL;

-- 3. Populate growth_potential from growth_rate (assuming growth_rate is percentage)
UPDATE careers
SET growth_potential =
  CASE
    WHEN growth_rate >= 20 THEN 'high'
    WHEN growth_rate >= 10 THEN 'medium'
    ELSE 'low'
  END
WHERE growth_potential IS NULL;

-- 4. Populate typical_traits based on demand_level and growth_rate
UPDATE careers
SET typical_traits =
  ARRAY[
    COALESCE(demand_level, 'Stable'),
    CASE
      WHEN growth_rate >= 20 THEN 'Growth-oriented'
      WHEN growth_rate >= 10 THEN 'Steady'
      ELSE 'Mature'
    END,
    COALESCE(category, 'Professional')
  ]
WHERE typical_traits IS NULL OR array_length(typical_traits, 1) = 0;

-- 5. Populate preferred_interests (use category + demand level + related fields)
UPDATE careers
SET preferred_interests = ARRAY[
  COALESCE(category, 'Career Growth'),
  COALESCE(demand_level, 'Market Demand'),
  'Professional Development'
]
WHERE preferred_interests IS NULL OR array_length(preferred_interests, 1) = 0;

-- 6. Set is_active = true for all existing careers
UPDATE careers
SET is_active = true
WHERE is_active IS NULL;

-- 7. Populate preferred_interests for careers that already have some skills
-- (Optional enhancement: infer interests from required_skills)
UPDATE careers
SET preferred_interests =
  ARRAY[
    COALESCE(category, 'Career Growth'),
    COALESCE(demand_level, 'Market Demand'),
    'Professional Development',
    'Skill-based'
  ]
WHERE preferred_interests IS NULL
   OR array_length(preferred_interests, 1) < 2;

-- Verify the updates
SELECT
  title,
  category,
  tags,
  salary_range_min,
  salary_range_max,
  growth_potential,
  typical_traits,
  preferred_interests
FROM careers
ORDER BY title
LIMIT 5;

SELECT 'Data migration completed!' as message;
