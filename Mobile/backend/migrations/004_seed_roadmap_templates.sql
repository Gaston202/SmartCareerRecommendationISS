-- =============================================
-- SEED CAREER ROADMAP TEMPLATES
-- Insert roadmap templates for each career
-- =============================================

-- First, check how many careers we have
DO $$
DECLARE
  career_count INTEGER;
BEGIN
  SELECT COUNT(*) INTO career_count FROM careers;

  IF career_count = 0 THEN
    RAISE NOTICE 'No careers found. Add careers first.';
    RETURN;
  END IF;

  RAISE NOTICE 'Found % careers. You can add roadmap templates for each.', career_count;
END $$;

-- Example template structure (modify for your actual career data)
-- Replace 'career-uuid-here' with actual career IDs from your careers table

-- Template 1: For a Software Engineer (if you have one)
/*
INSERT INTO career_roadmaps (career_id, title, description, milestones, total_duration_weeks) VALUES (
  'career-uuid-here', -- Replace with actual career ID
  'Roadmap to Becoming a Software Engineer',
  'A comprehensive 6-month plan to go from beginner to job-ready software engineer.',
  '[
    {
      "id": "foundation",
      "title": "Month 1-2: Programming Foundation",
      "description": "Master core programming concepts, data structures, and algorithms.",
      "duration_weeks": 8,
      "tasks": [
        {"id": "t1", "title": "Learn a programming language (JavaScript/Python)", "estimated_hours": 40, "dependencies": []},
        {"id": "t2", "title": "Study data structures: arrays, linked lists, hash maps", "estimated_hours": 20, "dependencies": ["t1"]},
        {"id": "t3", "title": "Practice algorithms: sorting, searching, recursion", "estimated_hours": 30, "dependencies": ["t1"]},
        {"id": "t4", "title": "Build 3 small projects", "estimated_hours": 40, "dependencies": ["t1"]}
      ],
      "resources": [
        {"type": "course", "title": "CS50 or freeCodeCamp", "url": "https://cs50.harvard.edu/"},
        {"type": "book", "title": "Eloquent JavaScript", "url": "https://eloquentjavascript.net/"}
      ]
    },
    {
      "id": "specialization",
      "title": "Month 3-4: Specialization & Frameworks",
      "description": "Choose a tech stack and build real-world applications.",
      "duration_weeks": 8,
      "tasks": [
        {"id": "t5", "title": "Learn a framework (React, Vue, or Angular)", "estimated_hours": 30},
        {"id": "t6", "title": "Build a full-stack app with backend API", "estimated_hours": 60},
        {"id": "t7", "title": "Learn version control (Git) and collaboration", "estimated_hours": 10}
      ],
      "resources": [
        {"type": "course", "title": "React Official Docs", "url": "https://react.dev/"},
        {"type": "platform", "title": "GitHub", "url": "https://github.com/"}
      ]
    },
    {
      "id": "preparation",
      "title": "Month 5-6: Interview Prep & Portfolio",
      "description": "Prepare for technical interviews and build a showcase portfolio.",
      "duration_weeks": 8,
      "tasks": [
        {"id": "t8", "title": "LeetCode practice (100+ problems)", "estimated_hours": 50},
        {"id": "t9", "title": "Build portfolio website", "estimated_hours": 20},
        {"id": "t10", "title": "Mock interviews with peers", "estimated_hours": 10}
      ],
      "resources": [
        {"type": "platform", "title": "LeetCode", "url": "https://leetcode.com/"},
        {"type": "guide", "title": "System Design Interview", "url": "https://github.com/donnemartin/system-design-primer"}
      ]
    }
  ]'::jsonb,
  24
);

-- Template 2: For Product Manager
/*
INSERT INTO career_roadmaps (career_id, title, description, milestones, total_duration_weeks) VALUES (
  'another-career-uuid',
  'Roadmap to Becoming a Product Manager',
  'A 6-8 month journey to develop product management skills and land your first PM role.',
  '[...]'::jsonb,
  28
);
*/

-- To generate templates for ALL careers automatically, you can run:
INSERT INTO career_roadmaps (career_id, title, description, milestones, total_duration_weeks)
SELECT
  c.id,
  'Roadmap to Becoming a ' || c.title,
  'A personalized career roadmap for ' || c.title || '. This plan covers essential skills, certifications, and experience needed to succeed.',
  '[
    {
      "id": "phase1",
      "title": "Phase 1: Foundation & Core Skills",
      "description": "Build fundamental knowledge and skills for this career path.",
      "duration_weeks": 8,
      "tasks": [
        {
          "id": "task1",
          "title": "Master core concepts: ' || c.title || ' fundamentals",
          "estimated_hours": 40,
          "dependencies": []
        },
        {
          "id": "task2",
          "title": "Complete relevant certifications or courses",
          "estimated_hours": 60,
          "dependencies": ["task1"]
        },
        {
          "id": "task3",
          "title": "Build a portfolio or project demonstrating skills",
          "estimated_hours": 80,
          "dependencies": ["task1", "task2"]
        }
      ],
      "resources": [
        {
          "type": "course",
          "title": "Career-specific courses",
          "description": "Find courses related to ' || c.category || '"
        }
      ]
    },
    {
      "id": "phase2",
      "title": "Phase 2: Practical Experience",
      "description": "Gain hands-on experience through projects, internships, or current job.",
      "duration_weeks": 12,
      "tasks": [
        {
          "id": "task4",
          "title": "Apply skills in real projects",
          "estimated_hours": 100,
          "dependencies": ["task3"]
        },
        {
          "id": "task5",
          "title": "Network with professionals in the field",
          "estimated_hours": 20,
          "dependencies": ["task3"]
        }
      ],
      "resources": [
        {
          "type": "networking",
          "title": "Industry connections",
          "description": "Join LinkedIn groups, attend meetups"
        }
      ]
    },
    {
      "id": "phase3",
      "title": "Phase 3: Job Search & Advancement",
      "description": "Prepare for interviews, optimize resume, and apply strategically.",
      "duration_weeks": 8,
      "tasks": [
        {
          "id": "task6",
          "title": "Tailor resume for ' || c.title || ' roles",
          "estimated_hours": 10,
          "dependencies": ["task3", "task4"]
        },
        {
          "id": "task7",
          "title": "Practice interviews (technical and behavioral)",
          "estimated_hours": 30,
          "dependencies": ["task6"]
        },
        {
          "id": "task8",
          "title": "Apply to positions and track progress",
          "estimated_hours": 20,
          "dependencies": ["task6", "task7"]
        }
      ],
      "resources": [
        {
          "type": "guide",
          "title": "Interview preparation",
          "description": "Research common interview questions for this role"
        }
      ]
    }
  ]'::jsonb,
  28  -- Total 28 weeks (7 months)
FROM careers c
WHERE NOT EXISTS (
  SELECT 1 FROM career_roadmaps cr WHERE cr.career_id = c.id
);

-- Verify templates created
SELECT
  cr.id,
  c.title as career_title,
  cr.title as roadmap_title,
  jsonb_array_length(cr.milestones) as milestone_count,
  cr.total_duration_weeks
FROM career_roadmaps cr
JOIN careers c ON cr.career_id = c.id
ORDER BY c.title
LIMIT 10;

SELECT 'Roadmap templates seeded!' as message;
