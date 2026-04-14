import { Injectable } from '@nestjs/common';
import * as Handlebars from 'handlebars';

export interface PromptTemplate {
  name: string;
  template: string;
  model: string;
  temperature: number;
  maxTokens: number;
}

@Injectable()
export class PromptRegistry {
  private prompts: Map<string, PromptTemplate> = new Map();
  private compiler = Handlebars.create();

  constructor() {
    this.registerPrompts();
    console.log('='.repeat(60));
    console.log('✅ PROMPT REGISTRY LOADED - Quiz prompts aligned to Nova Profile dimensions');
    const quizPrompt = this.prompts.get('quiz-question');
    if (quizPrompt) {
      console.log('📝 Quiz question prompt preview:');
      console.log(quizPrompt.template.substring(0, 400) + '...');
    }
    console.log('='.repeat(60));
  }

  private registerPrompts() {
    // Quiz Question Generation - Nova Profile Focused
    this.prompts.set('quiz-question', {
      name: 'quiz-question',
      template: `You are an expert psychometric assessment AI generating Nova Profile questions.

CRITICAL: Your questions must measure Nova Profile dimensions for personal and professional development.

USER'S PREVIOUS ANSWERS (understand their preferences from these):
{{#each answers}}
  Q{{@index}}: {{this}}
{{/each}}

PREVIOUS QUESTIONS ALREADY ASKED (DO NOT REPEAT OR PARAPHRASE):
{{#if previousQuestions.length}}
{{#each previousQuestions}}
  - {{this}}
{{/each}}
{{else}}
  - None yet
{{/if}}

CURRENT QUESTION NUMBER: {{questionNumber}} / 10
REQUIRED DIMENSION FOR THIS QUESTION: {{requiredDimension}}

YOUR MISSION:
Generate the NEXT question that explores a NEW Nova dimension. DO NOT repeat themes already covered. BUILD on what you've learned.
The next question must be semantically different from all previous questions above (not just different wording).

STEP 1 - Analyze previous answers to deduce their preferences:
- Infer likely DISC tendencies and style patterns (natural vs adapted)
- Identify which Nova dimensions are still unmeasured (use checklist below)
- Choose one NEW dimension that improves profile depth

STEP 2 - Select a NEW topic from this Nova checklist (exactly one per question):
□ Dominance vs influence vs steadiness vs compliance preference (DISC)
□ Natural style (default behavior when relaxed)
□ Adapted style (behavior in formal/high-expectation settings)
□ Motivation drivers (recognition, mastery, impact, autonomy, stability)
□ Core work values (results, harmony, innovation, precision)
□ Communication style (direct, diplomatic, expressive, analytical)
□ Cognitive preference (structured analysis vs experimentation vs relational judgment)
□ Decision style (speed/action vs consensus vs evidence depth)
□ Learning & development preference (coaching, hands-on, independent study, structured path)
□ Leadership/team dynamic preference (leading, supporting, collaborating, expert role)

IMPORTANT DIMENSION CONSTRAINT:
- You MUST center this question on: "{{requiredDimension}}"
- If your draft question is not clearly about "{{requiredDimension}}", rewrite it before returning JSON.

STEP 3 - Write a clear, simple question about that NEW topic. The question should:
- Be 10-18 words
- Ask directly about PREFERENCES (not past events or interview scenarios)
- Example format: "Do you prefer [option A] or [option B]?" or "What is most important to you: X, Y, or Z?"
- Include ONLY the question sentence (no answer choices, no bullets, no numbering)

STEP 4 - Create exactly 4 preference options labeled with DISC colors:
- red: action, results, competition, decisiveness
- blue: analysis, quality, precision, systematic thinking
- green: collaboration, support, harmony, relationships
- yellow: creativity, innovation, expression, big-picture thinking

FORMAT REQUIREMENTS - STRICT:
{
  "type": "question",
  "questionNumber": {{questionNumber}},
  "totalQuestions": 10,
  "question": "string - your new question here",
  "options": [
    { "id": "red|blue|green|yellow", "label": "string (5-12 words describing preference)", "icon": "brush|people|globe|business|...|code" }
  ]
}

RULES - NEVER VIOLATE:
- ❌ NO questions about resumes, CVs, interviews, job applications
- ❌ NO questions about past experience, education, training
- ❌ NO questions about stress responses or conflict handling
- ❌ NO “what is your greatest weakness” or “describe a time”
- ❌ NO repeated/paraphrased questions about the same theme
- ❌ DO NOT embed answer options in the "question" text (no "A/B/C/D", no numbered or bulleted choices)
- ❌ NO questions that don't reveal psychometric preferences
- ✓ Questions should measure Nova dimensions: behavior, cognition, motivation, values, communication
- ✓ Each answer option should map clearly to one DISC color tendency

IMPORTANT: The user will see 10 questions total. Cover different Nova dimensions across the full sequence.

Now generate the next question based on what's already been asked:`,
      model: 'arcee-ai/trinity-large-preview:free',
      temperature: 0.85,
      maxTokens: 700,
    });

    // Quiz Results Generation
    this.prompts.set('quiz-results', {
      name: 'quiz-results',
      template: `Based on these 10 quiz answers, generate a comprehensive Nova psychometric profile and top career matches.

Answers:
{{#each answers}}
  Q{{@index}}: {{this}}
{{/each}}

CRITICAL: Output ONLY valid JSON with no additional text, explanations, or markdown. Do not add any commentary before or after the JSON.

{
  "type": "results",
  "careers": [
    {
      "title": "string",
      "description": "string (1-2 sentences)",
      "matchPercent": number (75-98),
      "tags": ["string", ...] (2-4 tags)
    }
  ],
  "novaProfile": {
    "headline": "string (short, professional headline)",
    "professionalIdentity": "string (e.g., 'Marketing and Communications Professional')",
    "behavior": {
      "primaryStyle": "string (e.g., 'Dominance (Red)' or 'Influence (Yellow)' etc)",
      "secondaryStyle": "string (optional, e.g., 'Steadiness (Green)')",
      "traits": ["string", ...] (array of 3-5 descriptive traits like 'Reliable', 'Analytical', 'Creative'),
      "discBlend": "string (e.g., 'R25 / Y30 / G20 / B25')",
      "discPercentages": {
        "red": number,
        "yellow": number,
        "green": number,
        "blue": number
      }
    },
    "styleComparison": {
      "naturalStyleSummary": "string (description of natural work style)",
      "adaptedStyleSummary": "string (description of adapted style under pressure)",
      "adaptationDrivers": ["string", ...] (array of 2-3 factors that drive adaptation, e.g., 'Tight deadlines', 'High performance expectations'),
      "stressSignals": ["string", ...] (array of 2-3 stress signals, e.g., 'Mental overload', 'Over-controlling')
    },
    "motivations": {
      "topMotivators": ["string", ...] (array of 3 top motivators),
      "demotivators": ["string", ...] (array of 2-3 demotivators),
      "valuesSummary": "string (summary of what drives the user)"
    },
    "cognition": {
      "decisionStyle": "string (e.g., 'Data-driven and collaborative')",
      "thinkingStyle": "string (e.g., 'Analytical thinking with strategic projection')",
      "learningStyle": "string (e.g., 'Hands-on learning through feedback and iteration')",
      "communicationStyle": "string (e.g., 'Clear, respectful, solution-oriented')"
    },
    "careerProjection": {
      "bestFitEnvironments": ["string", ...] (array of 2-3 work environment descriptions),
      "leadershipStyle": "string (e.g., 'Structured leadership: human support plus clear expectations')",
      "watchouts": ["string", ...] (array of 2-3 potential pitfalls or areas to watch under stress),
      "futureFocus": "string (trajectory description, e.g., 'Strong trajectory toward leadership or senior expertise')"
    },
    "recommendedDevelopmentAxes": ["string", ...] (array of 3-4 development areas like 'Strengthen prioritization', 'Develop cross-functional influence')
  }
}`,
      model: 'arcee-ai/trinity-large-preview:free',
      temperature: 0.6,
      maxTokens: 2000,
    });

    // CV Analysis
    this.prompts.set('cv-analysis', {
      name: 'cv-analysis',
      template: `Extract structured data from this CV/resume text.

CV Text:
{{text}}

CRITICAL: Return ONLY valid JSON with no additional text or explanations.

{
  "skills": ["skill1", "skill2"],
  "experience": [
    { "title": "...", "company": "...", "duration": "...", "description": "..." }
  ],
  "education": [
    { "degree": "...", "institution": "...", "year": "..." }
  ],
  "summary": "Brief summary"
}`,
      model: 'arcee-ai/trinity-large-preview:free',
      temperature: 0.3,
      maxTokens: 1500,
    });

    // CV Suggestions
    this.prompts.set('cv-suggestions', {
      name: 'cv-suggestions',
      template: `Analyze this CV and provide improvement suggestions.

CV: {{cvText}}

ATS Score: {{atsScore}}/100

CRITICAL: Return ONLY valid JSON with no additional text or explanations.

{
  "ats_issues": [
    { "type": "...", "severity": "low|medium|high", "description": "...", "fix": "..." }
  ],
  "suggested_improvements": [
    { "section": "...", "suggestion": "...", "example": "..." }
  ]
}`,
      model: 'arcee-ai/trinity-large-preview:free',
      temperature: 0.5,
      maxTokens: 1000,
    });

    // Roadmap Personalization (RAG)
    this.prompts.set('roadmap-personalization', {
      name: 'roadmap-personalization',
      template: `Personalize this career roadmap based on the user's profile.

Base Roadmap:
{{roadmap}}

User Profile:
- Skills: {{skills}}
- Quiz Results: {{novaProfile}}
- CV Summary: {{cvSummary}}

Tailor the roadmap to their specific context. Keep structure, adjust timelines and resources.

CRITICAL: Output ONLY valid JSON with no additional text or explanations.

{
  "personalizedMilestones": [
    {
      "title": "...",
      "description": "...",
      "durationWeeks": 4,
      "tasks": ["..."],
      "resources": ["..."]
    }
  ]
}`,
      model: 'arcee-ai/trinity-large-preview:free',
      temperature: 0.7,
      maxTokens: 2000,
    });
  }

  get(name: string): PromptTemplate | undefined {
    return this.prompts.get(name);
  }

  compile(templateName: string, context: any): string {
    const prompt = this.prompts.get(templateName);
    if (!prompt) {
      throw new Error(`Prompt not found: ${templateName}`);
    }
    const compiled = this.compiler.compile(prompt.template);
    return compiled(context);
  }
}
