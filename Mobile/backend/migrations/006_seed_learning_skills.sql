-- =============================================
-- SEED LEARNING SKILLS AND COURSES
-- Example data for learning roadmaps
-- =============================================

-- Get some careers to associate with
DO $$
DECLARE
  backend_career_id UUID;
  frontend_career_id UUID;
  fullstack_career_id UUID;
BEGIN

SELECT id INTO backend_career_id FROM careers WHERE title ILIKE '%backend%' LIMIT 1;
SELECT id INTO frontend_career_id FROM careers WHERE title ILIKE '%frontend%' LIMIT 1;
SELECT id INTO fullstack_career_id FROM careers WHERE title ILIKE '%full stack%' LIMIT 1;

-- If no careers, just proceed with NULL foreign keys (skills are still useful)

-- =============================================
-- BACKEND DEVELOPER SKILLS
-- =============================================

-- 1. Git & Version Control
INSERT INTO learning_skills (name, description, level, duration_hours, category, importance, career_id)
VALUES ('Git & Version Control', 'Learn Git commands, branching, merging, and collaborative workflows using platforms like GitHub and GitLab', 'beginner', 30, 'DevOps', 'critical', backend_career_id)
ON CONFLICT DO NOTHING;

-- 2. JavaScript Fundamentals
INSERT INTO learning_skills (name, description, level, duration_hours, category, importance, career_id)
VALUES ('JavaScript Fundamentals', 'Master core JavaScript concepts: variables, functions, objects, async/await, and ES6+ features', 'beginner', 60, 'Backend', 'critical', backend_career_id)
ON CONFLICT DO NOTHING;

-- 3. Node.js
INSERT INTO learning_skills (name, description, level, duration_hours, category, importance, career_id)
VALUES ('Node.js', 'Build server-side applications with Node.js, understand event loop, streams, and middleware', 'intermediate', 50, 'Backend', 'critical', backend_career_id)
ON CONFLICT DO NOTHING;

-- 4. SQL & Databases
INSERT INTO learning_skills (name, description, level, duration_hours, category, importance, career_id)
VALUES ('SQL & Relational Databases', 'Write efficient SQL queries, design schemas, understand normalization, indexing, and query optimization', 'intermediate', 60, 'Backend', 'critical', backend_career_id)
ON CONFLICT DO NOTHING;

-- 5. REST APIs
INSERT INTO learning_skills (name, description, level, duration_hours, category, importance, career_id)
VALUES ('REST APIs & HTTP', 'Design and build RESTful APIs, understand HTTP methods, status codes, authentication, and best practices', 'intermediate', 40, 'Backend', 'critical', backend_career_id)
ON CONFLICT DO NOTHING;

-- 6. Express.js/Framework
INSERT INTO learning_skills (name, description, level, duration_hours, category, importance, career_id)
VALUES ('Express.js Framework', 'Build web applications using Express.js, routing, middleware, error handling, and deployment', 'intermediate', 45, 'Backend', 'important', backend_career_id)
ON CONFLICT DO NOTHING;

-- 7. Authentication & Security
INSERT INTO learning_skills (name, description, level, duration_hours, category, importance, career_id)
VALUES ('Authentication & Security', 'Implement JWT, OAuth, encryption, password hashing, CORS, and secure API practices', 'intermediate', 40, 'Backend', 'critical', backend_career_id)
ON CONFLICT DO NOTHING;

-- 8. Docker & Containerization
INSERT INTO learning_skills (name, description, level, duration_hours, category, importance, career_id)
VALUES ('Docker & Containerization', 'Create Docker containers, write Dockerfiles, use Docker Compose, and understand containerization principles', 'intermediate', 35, 'DevOps', 'important', backend_career_id)
ON CONFLICT DO NOTHING;

-- 9. CI/CD & Deployment
INSERT INTO learning_skills (name, description, level, duration_hours, category, importance, career_id)
VALUES ('CI/CD & Deployment', 'Set up GitHub Actions, GitLab CI/CD, understand pipelines, automated testing, and production deployment', 'advanced', 50, 'DevOps', 'important', backend_career_id)
ON CONFLICT DO NOTHING;

-- 10. Testing (Unit & Integration)
INSERT INTO learning_skills (name, description, level, duration_hours, category, importance, career_id)
VALUES ('Testing (Unit & Integration)', 'Write unit tests with Jest, integration tests, test coverage, and TDD practices', 'intermediate', 45, 'Backend', 'important', backend_career_id)
ON CONFLICT DO NOTHING;

-- =============================================
-- SKILL DEPENDENCIES (Backend path)
-- =============================================

-- Git is prerequisite for CI/CD
INSERT INTO skill_dependencies (from_skill_id, to_skill_id, dependency_type)
SELECT s1.id, s2.id, 'required'
FROM learning_skills s1, learning_skills s2
WHERE s1.name = 'Git & Version Control' 
AND s2.name = 'CI/CD & Deployment'
ON CONFLICT DO NOTHING;

-- JavaScript is prerequisite for Node.js
INSERT INTO skill_dependencies (from_skill_id, to_skill_id, dependency_type)
SELECT s1.id, s2.id, 'required'
FROM learning_skills s1, learning_skills s2
WHERE s1.name = 'JavaScript Fundamentals'
AND s2.name = 'Node.js'
ON CONFLICT DO NOTHING;

-- Node.js is prerequisite for Express.js
INSERT INTO skill_dependencies (from_skill_id, to_skill_id, dependency_type)
SELECT s1.id, s2.id, 'required'
FROM learning_skills s1, learning_skills s2
WHERE s1.name = 'Node.js'
AND s2.name = 'Express.js Framework'
ON CONFLICT DO NOTHING;

-- Node.js is prerequisite for REST APIs
INSERT INTO skill_dependencies (from_skill_id, to_skill_id, dependency_type)
SELECT s1.id, s2.id, 'required'
FROM learning_skills s1, learning_skills s2
WHERE s1.name = 'Node.js'
AND s2.name = 'REST APIs & HTTP'
ON CONFLICT DO NOTHING;

-- REST APIs is prerequisite for Authentication
INSERT INTO skill_dependencies (from_skill_id, to_skill_id, dependency_type)
SELECT s1.id, s2.id, 'required'
FROM learning_skills s1, learning_skills s2
WHERE s1.name = 'REST APIs & HTTP'
AND s2.name = 'Authentication & Security'
ON CONFLICT DO NOTHING;

-- Testing is prerequisite for CI/CD
INSERT INTO skill_dependencies (from_skill_id, to_skill_id, dependency_type)
SELECT s1.id, s2.id, 'required'
FROM learning_skills s1, learning_skills s2
WHERE s1.name = 'Testing (Unit & Integration)'
AND s2.name = 'CI/CD & Deployment'
ON CONFLICT DO NOTHING;

-- Git is prerequisite for CI/CD (already added)

-- =============================================
-- LEARNING COURSES FOR SKILLS
-- =============================================

-- Git Courses
INSERT INTO learning_courses (skill_id, title, description, provider, url, duration_hours, level, rating, free, course_type)
SELECT id, 'Git Complete: The definitive, step-by-step guide', 'Master Git from basics to advanced workflows', 'Udemy', 'https://www.udemy.com/course/git-complete/', 5, 'beginner', 4.7, FALSE, 'video'
FROM learning_skills WHERE name = 'Git & Version Control' LIMIT 1
ON CONFLICT DO NOTHING;

INSERT INTO learning_courses (skill_id, title, description, provider, url, duration_hours, level, rating, free, course_type)
SELECT id, 'Git Basics', 'Learn the basics of Git version control', 'freeCodeCamp', 'https://www.youtube.com/watch?v=RGOj5yH7evk', 3, 'beginner', 4.8, TRUE, 'video'
FROM learning_skills WHERE name = 'Git & Version Control' LIMIT 1
ON CONFLICT DO NOTHING;

INSERT INTO learning_courses (skill_id, title, description, provider, url, duration_hours, level, rating, free, course_type)
SELECT id, 'GitHub Skills', 'Interactive GitHub learning path', 'GitHub', 'https://github.com/skills', 2, 'beginner', 4.9, TRUE, 'interactive'
FROM learning_skills WHERE name = 'Git & Version Control' LIMIT 1
ON CONFLICT DO NOTHING;

-- JavaScript Courses
INSERT INTO learning_courses (skill_id, title, description, provider, url, duration_hours, level, rating, free, course_type)
SELECT id, 'The Complete JavaScript Course 2024', 'Comprehensive JavaScript course from basics to advanced', 'Udemy', 'https://www.udemy.com/course/the-complete-javascript-course/', 30, 'beginner', 4.8, FALSE, 'video'
FROM learning_skills WHERE name = 'JavaScript Fundamentals' LIMIT 1
ON CONFLICT DO NOTHING;

INSERT INTO learning_courses (skill_id, title, description, provider, url, duration_hours, level, rating, free, course_type)
SELECT id, 'JavaScript Algorithm Basics', 'Free JavaScript fundamentals from freeCodeCamp', 'freeCodeCamp', 'https://www.youtube.com/watch?v=PkZYUUvFM_U', 5, 'beginner', 4.9, TRUE, 'video'
FROM learning_skills WHERE name = 'JavaScript Fundamentals' LIMIT 1
ON CONFLICT DO NOTHING;

INSERT INTO learning_courses (skill_id, title, description, provider, url, duration_hours, level, rating, free, course_type)
SELECT id, 'JavaScript.info', 'Interactive JavaScript tutorial', 'JavaScript.info', 'https://javascript.info/', 20, 'beginner', 4.9, TRUE, 'interactive'
FROM learning_skills WHERE name = 'JavaScript Fundamentals' LIMIT 1
ON CONFLICT DO NOTHING;

-- Node.js Courses
INSERT INTO learning_courses (skill_id, title, description, provider, url, duration_hours, level, rating, free, course_type)
SELECT id, 'The Complete Node.js Developer Course', 'Learn Node.js from scratch to advanced', 'Udemy', 'https://www.udemy.com/course/the-complete-nodejs-developer-course-2/', 25, 'intermediate', 4.7, FALSE, 'video'
FROM learning_skills WHERE name = 'Node.js' LIMIT 1
ON CONFLICT DO NOTHING;

INSERT INTO learning_courses (skill_id, title, description, provider, url, duration_hours, level, rating, free, course_type)
SELECT id, 'Node.js Tutorial', 'Node.js fundamentals on W3Schools', 'W3Schools', 'https://www.w3schools.com/nodejs/', 8, 'intermediate', 4.6, TRUE, 'interactive'
FROM learning_skills WHERE name = 'Node.js' LIMIT 1
ON CONFLICT DO NOTHING;

-- SQL Courses
INSERT INTO learning_courses (skill_id, title, description, provider, url, duration_hours, level, rating, free, course_type)
SELECT id, 'SQL Tutorial', 'Complete SQL tutorial', 'W3Schools', 'https://www.w3schools.com/sql/', 10, 'intermediate', 4.8, TRUE, 'interactive'
FROM learning_skills WHERE name = 'SQL & Relational Databases' LIMIT 1
ON CONFLICT DO NOTHING;

INSERT INTO learning_courses (skill_id, title, description, provider, url, duration_hours, level, rating, free, course_type)
SELECT id, 'The Ultimate MySQL Bootcamp', 'Master MySQL database design and queries', 'Udemy', 'https://www.udemy.com/course/the-ultimate-mysql-bootcamp-go-from-sql-beginner-to-expert/', 20, 'intermediate', 4.7, FALSE, 'video'
FROM learning_skills WHERE name = 'SQL & Relational Databases' LIMIT 1
ON CONFLICT DO NOTHING;

-- REST API Courses
INSERT INTO learning_courses (skill_id, title, description, provider, url, duration_hours, level, rating, free, course_type)
SELECT id, 'REST API Tutorial', 'Learn REST API design principles', 'Restfulapi.net', 'https://restfulapi.net/', 5, 'intermediate', 4.8, TRUE, 'text'
FROM learning_skills WHERE name = 'REST APIs & HTTP' LIMIT 1
ON CONFLICT DO NOTHING;

INSERT INTO learning_courses (skill_id, title, description, provider, url, duration_hours, level, rating, free, course_type)
SELECT id, 'Node.js, Express, MongoDB & More - The Complete Bootcamp', 'Build RESTful APIs with Express and MongoDB', 'Udemy', 'https://www.udemy.com/course/build-a-complete-app-with-nodejs/', 55, 'intermediate', 4.8, FALSE, 'video'
FROM learning_skills WHERE name = 'REST APIs & HTTP' LIMIT 1
ON CONFLICT DO NOTHING;

-- Express.js Courses
INSERT INTO learning_courses (skill_id, title, description, provider, url, duration_hours, level, rating, free, course_type)
SELECT id, 'Express.js Tutorial', 'Learn Express.js framework', 'W3Schools', 'https://www.w3schools.com/nodejs/nodejs_express.asp', 5, 'intermediate', 4.7, TRUE, 'interactive'
FROM learning_skills WHERE name = 'Express.js Framework' LIMIT 1
ON CONFLICT DO NOTHING;

-- Docker Courses
INSERT INTO learning_courses (skill_id, title, description, provider, url, duration_hours, level, rating, free, course_type)
SELECT id, 'Docker & Kubernetes: The Complete Guide', 'Master Docker containerization', 'Udemy', 'https://www.udemy.com/course/docker-and-kubernetes-the-complete-guide/', 22, 'intermediate', 4.7, FALSE, 'video'
FROM learning_skills WHERE name = 'Docker & Containerization' LIMIT 1
ON CONFLICT DO NOTHING;

INSERT INTO learning_courses (skill_id, title, description, provider, url, duration_hours, level, rating, free, course_type)
SELECT id, 'Docker Tutorial', 'Docker fundamentals', 'Docker Docs', 'https://docs.docker.com/get-started/', 4, 'intermediate', 4.9, TRUE, 'text'
FROM learning_skills WHERE name = 'Docker & Containerization' LIMIT 1
ON CONFLICT DO NOTHING;

-- CI/CD Courses
INSERT INTO learning_courses (skill_id, title, description, provider, url, duration_hours, level, rating, free, course_type)
SELECT id, 'Complete CI/CD with Jenkins, Maven, SonarQube', 'Learn complete CI/CD pipeline setup', 'Udemy', 'https://www.udemy.com/course/complete-cicd-with-jenkins-maven-sonarqube-artifactory/', 16, 'advanced', 4.6, FALSE, 'video'
FROM learning_skills WHERE name = 'CI/CD & Deployment' LIMIT 1
ON CONFLICT DO NOTHING;

INSERT INTO learning_courses (skill_id, title, description, provider, url, duration_hours, level, rating, free, course_type)
SELECT id, 'GitHub Actions Tutorial', 'Learn GitHub Actions for CI/CD', 'GitHub', 'https://docs.github.com/en/actions/learn-github-actions', 6, 'advanced', 4.8, TRUE, 'text'
FROM learning_skills WHERE name = 'CI/CD & Deployment' LIMIT 1
ON CONFLICT DO NOTHING;

-- Testing Courses
INSERT INTO learning_courses (skill_id, title, description, provider, url, duration_hours, level, rating, free, course_type)
SELECT id, 'Writing Tests with Jest', 'Master unit testing and TDD with Jest', 'freeCodeCamp', 'https://www.youtube.com/watch?v=7r4xVZIrjJ8', 10, 'intermediate', 4.8, TRUE, 'video'
FROM learning_skills WHERE name = 'Testing (Unit & Integration)' LIMIT 1
ON CONFLICT DO NOTHING;

INSERT INTO learning_courses (skill_id, title, description, provider, url, duration_hours, level, rating, free, course_type)
SELECT id, 'Jest: JavaScript Testing Framework', 'Complete Jest testing guide', 'Jest Official', 'https://jestjs.io/docs/getting-started', 8, 'intermediate', 4.9, TRUE, 'text'
FROM learning_skills WHERE name = 'Testing (Unit & Integration)' LIMIT 1
ON CONFLICT DO NOTHING;

END $$;

SELECT 'Learning skills and courses seeded successfully!' as message;
