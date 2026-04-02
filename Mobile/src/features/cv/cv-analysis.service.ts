/**
 * CV Analysis Service
 * Analyzes CV using backend AI pipeline (ai_v2 agents)
 * No client-side OpenRouter calls - all processing goes through backend
 */

import { supabase } from "../../api/supabase";
import AsyncStorage from "@react-native-async-storage/async-storage";
import pako from "pako";
import type { CvAnalysis } from "./types";

// Types for OpenRouter response
interface OpenRouterAnalysis {
  ats_score: number;
  ats_issues: Array<{
    type: string;
    severity: "critical" | "warning" | "info";
    description: string;
  }>;
  ats_suggestions: Array<{
    section: string;
    suggestion: string;
    example?: string;
  }>;
  career_suggestions: Array<{
    title: string;
    match_score: number;
    reasoning?: string;
  }>;
  extracted_skills: string[];
  extracted_interests: string[];
}

const EXTRACTED_FIELDS_CACHE_KEY_PREFIX = "cv_analysis_extracted_fields:";

type CachedExtractedFields = {
  extracted_skills: string[];
  extracted_interests: string[];
};

function getExtractedFieldsCacheKey(cvId: string): string {
  return `${EXTRACTED_FIELDS_CACHE_KEY_PREFIX}${cvId}`;
}

function logDebug(message: string, ...args: unknown[]) {
  if (__DEV__) {
    console.log(message, ...args);
  }
}

function extractMessageContent(data: any): string {
  const message = data?.choices?.[0]?.message;
  const content = message?.content;

  if (typeof content === "string") {
    return content.trim();
  }

  if (Array.isArray(content)) {
    return content
      .map((part: any) => {
        if (typeof part === "string") return part;
        if (typeof part?.text === "string") return part.text;
        return "";
      })
      .join("\n")
      .trim();
  }

  return "";
}

function createRetryableParseError(message: string): Error & { status: number } {
  const error = new Error(message) as Error & { status: number };
  error.status = 503;
  return error;
}

function normalizeStringArray(value: unknown): string[] {
  if (!value) return [];

  if (Array.isArray(value)) {
    return value
      .map((item) => (typeof item === "string" ? item : ""))
      .map((item) => item.trim())
      .filter(Boolean);
  }

  if (typeof value === "string") {
    return value
      .split(",")
      .map((item) => item.trim())
      .filter(Boolean);
  }

  return [];
}

function mergeExtractedFields(
  analysis: CvAnalysis,
  extracted: CachedExtractedFields | null
): CvAnalysis {
  if (!extracted) return analysis;

  const hasSkills = normalizeStringArray(
    analysis.extracted_skills ?? analysis.skills_extracted ?? analysis.skills
  ).length > 0;
  const hasInterests = normalizeStringArray(
    analysis.extracted_interests ?? analysis.interests_extracted ?? analysis.interests
  ).length > 0;

  if (hasSkills && hasInterests) return analysis;

  return {
    ...analysis,
    extracted_skills: hasSkills ? analysis.extracted_skills : extracted.extracted_skills,
    extracted_interests: hasInterests ? analysis.extracted_interests : extracted.extracted_interests,
  };
}

async function cacheExtractedFields(cvId: string, extracted: CachedExtractedFields): Promise<void> {
  try {
    await AsyncStorage.setItem(getExtractedFieldsCacheKey(cvId), JSON.stringify(extracted));
  } catch (err) {
    console.warn("[cv-analysis] Could not cache extracted fields locally", err);
  }
}

export async function getCachedExtractedFields(cvId: string): Promise<CachedExtractedFields | null> {
  try {
    const raw = await AsyncStorage.getItem(getExtractedFieldsCacheKey(cvId));
    if (!raw) return null;

    const parsed = JSON.parse(raw) as Partial<CachedExtractedFields>;
    return {
      extracted_skills: normalizeStringArray(parsed.extracted_skills),
      extracted_interests: normalizeStringArray(parsed.extracted_interests),
    };
  } catch (err) {
    console.warn("[cv-analysis] Could not read extracted fields cache", err);
    return null;
  }
}

function extractSkillsAndInterestsFromText(cvText: string): {
  extracted_skills: string[];
  extracted_interests: string[];
} {
  const text = cvText.toLowerCase();

  const candidateSkills = [
    "JavaScript",
    "TypeScript",
    "Python",
    "Java",
    "React",
    "Next.js",
    "Node.js",
    "Express",
    "Django",
    "FastAPI",
    "PostgreSQL",
    "MongoDB",
    "Firebase",
    "Docker",
    "AWS",
    "Supabase",
    "Git",
  ];

  const candidateInterests = [
    "Web Development",
    "Full-Stack Development",
    "Cloud Computing",
    "Scalable Applications",
    "System Design",
    "Mentoring",
    "Real-time Applications",
    "Performance Optimization",
  ];

  const extractedSkills = candidateSkills.filter((skill) =>
    text.includes(skill.toLowerCase())
  );

  const extractedInterests = candidateInterests.filter((interest) => {
    const normalized = interest.toLowerCase();
    if (normalized.includes("full-stack")) return text.includes("full-stack") || text.includes("full stack");
    if (normalized.includes("web development")) return text.includes("web development") || text.includes("frontend") || text.includes("backend");
    if (normalized.includes("cloud")) return text.includes("cloud") || text.includes("aws") || text.includes("gcp") || text.includes("azure");
    if (normalized.includes("scalable")) return text.includes("scalable");
    if (normalized.includes("system design")) return text.includes("system design") || text.includes("architecture");
    if (normalized.includes("mentoring")) return text.includes("mentor") || text.includes("mentoring");
    if (normalized.includes("real-time")) return text.includes("real-time") || text.includes("realtime") || text.includes("websocket");
    if (normalized.includes("performance")) return text.includes("performance") || text.includes("optimization");
    return text.includes(normalized);
  });

  return {
    extracted_skills: extractedSkills,
    extracted_interests: extractedInterests,
  };
}

/**
 * Download PDF file from Supabase storage
 */
async function downloadPdfFromStorage(
  storagePath: string
): Promise<string> {
  logDebug(`[cv-analysis] Downloading PDF from storage:`, storagePath);

  try {
    // Use Supabase storage API directly (handles auth properly)
    const { data, error } = await supabase.storage
      .from("cvs_debug") // Bucket name
      .download(storagePath);

    if (error) {
      console.error(`[cv-analysis] ❌ Storage download error:`, error);
      throw new Error(`Failed to download PDF: ${error.message}`);
    }

    if (!data) {
      throw new Error("No data returned from storage");
    }

    logDebug(`[cv-analysis] 📦 Downloaded data type:`, {
      type: typeof data,
      isBlob: data instanceof Blob,
      size: (data as Blob).size,
      constructor: (data as any).constructor?.name,
    });

    // Convert Blob to base64
    let base64String = "";
    
    // Create a proper Promise-based approach
    const blobData = data as Blob;
    
    if (blobData.size === 0) {
      console.warn(`[cv-analysis] ⚠️ Warning: Downloaded blob is empty (0 bytes)`);
      throw new Error("Downloaded PDF is empty - storage issue");
    }

    // React Native: Convert Blob to base64
    // Use FileReader if available, otherwise use FileSystem approach
    logDebug(`[cv-analysis] Converting Blob to base64 for React Native...`);
    
    try {
      // Method 1: Try FileReader (available in React Native with polyfills)
      if (typeof FileReader !== 'undefined') {
        logDebug(`[cv-analysis] Using FileReader...`);
        const base64Data = await new Promise<string>((resolve, reject) => {
          const reader = new FileReader();
          reader.onloadend = () => {
            if (typeof reader.result === 'string') {
              // Remove the data URL prefix (e.g., "data:application/pdf;base64,")
              const base64 = reader.result.split(',')[1] || reader.result;
              resolve(base64);
            } else {
              reject(new Error('FileReader result is not a string'));
            }
          };
          reader.onerror = () => reject(reader.error);
          reader.readAsDataURL(blobData);
        });
        
        base64String = base64Data;
        logDebug(`[cv-analysis] ✅ Converted via FileReader (${base64String.length} chars)`);
      } else {
        throw new Error('FileReader not available, using fallback');
      }
    } catch (fileReaderError) {
      logDebug(`[cv-analysis] FileReader method failed, trying manual conversion...`);
      
      // Method 2: Manual conversion using Response API  
      try {
        logDebug(`[cv-analysis] Converting Blob manually using Response API...`);
        
        // Create a response from the blob to access arrayBuffer
        const response = new Response(blobData);
        const arrayBuffer = await response.arrayBuffer();
        
        logDebug(`[cv-analysis] 📊 ArrayBuffer details:`, {
          byteLength: arrayBuffer.byteLength,
          type: typeof arrayBuffer,
        });

        if (arrayBuffer.byteLength === 0) {
          throw new Error("ArrayBuffer is empty - PDF download failed");
        }

        // Convert ArrayBuffer to base64
        const bytes = new Uint8Array(arrayBuffer);
        let binary = "";
        const chunkSize = 8192; // Process in chunks to avoid stack overflow
        
        for (let i = 0; i < bytes.length; i += chunkSize) {
          const chunk = bytes.subarray(i, Math.min(i + chunkSize, bytes.length));
          binary += String.fromCharCode(...Array.from(chunk));
        }
        
        base64String = btoa(binary);
        logDebug(`[cv-analysis] ✅ Converted via Response API (${base64String.length} chars)`);
      } catch (manualError) {
        console.error(`[cv-analysis] ❌ Manual conversion failed:`, manualError);
        throw new Error(`Failed to convert Blob to base64: ${manualError}`);
      }
    }

    if (!base64String || base64String.length === 0) {
      throw new Error("PDF conversion resulted in empty base64 string");
    }

    logDebug(`[cv-analysis] ✅ PDF downloaded and converted to base64 (${base64String.length} chars)`);
    return base64String;
  } catch (err) {
    console.error(`[cv-analysis] ❌ Failed to download PDF:`, err);
    throw err;
  }
}

/**
 * Extract text from PDF using simple text extraction
 * Note: This is a simplified extraction - for production use proper PDF library
 */
async function extractTextFromPdfForAnalysis(pdfBase64: string): Promise<string> {
  logDebug(`[cv-analysis] Extracting text from PDF...`);

  try {
    const decodePdfString = (input: string): string => {
      let s = input
        .replace(/\\n/g, "\n")
        .replace(/\\r/g, "\r")
        .replace(/\\t/g, "\t")
        .replace(/\\b/g, "\b")
        .replace(/\\f/g, "\f")
        .replace(/\\\(/g, "(")
        .replace(/\\\)/g, ")")
        .replace(/\\\\/g, "\\");

      s = s.replace(/\\([0-7]{1,3})/g, (_, oct) => {
        const n = Number.parseInt(oct, 8);
        if (Number.isNaN(n)) return "";
        return String.fromCharCode(n);
      });

      return s;
    };

    const decodeHexPdfString = (hex: string): string => {
      const clean = hex.replace(/\s+/g, "");
      if (!clean.length) return "";

      const normalized = clean.length % 2 === 0 ? clean : `${clean}0`;
      const bytes: number[] = [];
      for (let i = 0; i < normalized.length; i += 2) {
        const parsed = Number.parseInt(normalized.slice(i, i + 2), 16);
        if (!Number.isNaN(parsed)) bytes.push(parsed);
      }

      if (bytes.length >= 2 && bytes[0] === 0xfe && bytes[1] === 0xff) {
        let out = "";
        for (let i = 2; i + 1 < bytes.length; i += 2) {
          out += String.fromCharCode((bytes[i] << 8) | bytes[i + 1]);
        }
        return out;
      }

      return String.fromCharCode(...bytes);
    };

    const extractTextOperators = (content: string): string[] => {
      const lines: string[] = [];

      const blocks = content.match(/BT[\s\S]*?ET/g) || [content];

      for (const block of blocks) {
        const literalMatches = block.matchAll(/\(((?:\\.|[^\\)])*)\)\s*Tj/g);
        for (const m of literalMatches) {
          const decoded = decodePdfString(m[1]).trim();
          if (decoded) lines.push(decoded);
        }

        const arrayMatches = block.matchAll(/\[(.*?)\]\s*TJ/gs);
        for (const m of arrayMatches) {
          const arr = m[1];
          const parts: string[] = [];
          const strParts = arr.matchAll(/\(((?:\\.|[^\\)])*)\)/g);
          for (const part of strParts) {
            const decoded = decodePdfString(part[1]);
            if (decoded.trim()) parts.push(decoded);
          }

          const hexParts = arr.matchAll(/<([0-9A-Fa-f\s]+)>/g);
          for (const part of hexParts) {
            const decoded = decodeHexPdfString(part[1]);
            if (decoded.trim()) parts.push(decoded);
          }

          const joined = parts.join("").trim();
          if (joined) lines.push(joined);
        }

        const hexTjMatches = block.matchAll(/<([0-9A-Fa-f\s]+)>\s*Tj/g);
        for (const m of hexTjMatches) {
          const decoded = decodeHexPdfString(m[1]).trim();
          if (decoded) lines.push(decoded);
        }
      }

      return lines;
    };

    const binary = atob(pdfBase64);
    const extractedLines: string[] = [];

    const streamRegex = /stream\r?\n([\s\S]*?)\r?\nendstream/g;
    let streamMatch: RegExpExecArray | null;
    while ((streamMatch = streamRegex.exec(binary)) !== null) {
      const streamBody = streamMatch[1];
      const bytes = new Uint8Array(streamBody.length);
      for (let i = 0; i < streamBody.length; i++) {
        bytes[i] = streamBody.charCodeAt(i) & 0xff;
      }

      try {
        const inflated = pako.inflate(bytes, { to: "string" }) as string;
        extractedLines.push(...extractTextOperators(inflated));
      } catch {
        // Stream may be uncompressed or use unsupported filter.
      }
    }

    if (extractedLines.length === 0) {
      extractedLines.push(...extractTextOperators(binary));
    }

    const normalizedText = extractedLines
      .map((line) => line.replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g, "").trim())
      .filter(Boolean)
      .join("\n")
      .trim();

    if (!normalizedText) {
      const err = new Error(
        "This PDF appears to be scanned or image-based. No selectable text was found. " +
        "Please upload a text-based PDF or convert your PDF from image-based to text-based format."
      ) as Error & { status?: number };
      err.status = 415; // Unsupported Media Type
      throw err;
    }

    logDebug(`[cv-analysis] ✅ PDF text extracted (${normalizedText.length} chars)`);
    return normalizedText;
  } catch (err) {
    console.error(`[cv-analysis] ❌ Failed to extract text:`, err);
    throw err;
  }
}

/**
 * Generate default/fallback CV analysis when OpenRouter API fails
 * Provides reasonable defaults based on CV content
 */
function generateFallbackAnalysis(cvText: string): OpenRouterAnalysis {
  console.warn(`[cv-analysis] ⚠️ Generating fallback analysis (OpenRouter unavailable)`);
  const extracted = extractSkillsAndInterestsFromText(cvText);
  
  // Simple heuristics to estimate ATS score based on CV content
  let atsScore = 65; // Base score
  
  // Boost for having key sections
  if (cvText.toLowerCase().includes('experience') || cvText.toLowerCase().includes('professional')) atsScore += 10;
  if (cvText.toLowerCase().includes('education')) atsScore += 8;
  if (cvText.toLowerCase().includes('skills') || cvText.toLowerCase().includes('technical')) atsScore += 8;
  if (cvText.toLowerCase().includes('certification') || cvText.toLowerCase().includes('certified')) atsScore += 5;
  
  // Penalize for uncommon formats
  if (cvText.includes('\t') || cvText.includes('|')) atsScore -= 5;
  
  atsScore = Math.min(95, Math.max(40, atsScore)); // Clamp between 40-95
  
  return {
    ats_score: atsScore,
    ats_issues: [
      {
        type: "content",
        severity: "info",
        description: "CV successfully uploaded and processed"
      },
      {
        type: "formatting",
        severity: "info",
        description: "Consider using standard section headers (EXPERIENCE, EDUCATION, SKILLS)"
      }
    ],
    ats_suggestions: [
      {
        section: "All",
        suggestion: "Use clear section headers and bullet points for better readability",
        example: "PROFESSIONAL EXPERIENCE • Project Name - Year"
      },
      {
        section: "Experience",
        suggestion: "Include quantifiable achievements and metrics",
        example: "Led team of 5 engineers resulting in 40% performance improvement"
      },
      {
        section: "Skills",
        suggestion: "List technical skills with proficiency levels",
        example: "Languages: JavaScript, TypeScript, Python • Frameworks: React, Node.js"
      }
    ],
    career_suggestions: [
      {
        title: "Software Engineer",
        match_score: 72,
        reasoning: "CV demonstrates technical background and professional experience"
      },
      {
        title: "Full Stack Developer",
        match_score: 68,
        reasoning: "Experience with multiple programming languages and frameworks"
      },
      {
        title: "Technical Lead",
        match_score: 65,
        reasoning: "Shows leadership and mentoring experience in professional roles"
      }
    ],
    extracted_skills: extracted.extracted_skills,
    extracted_interests: extracted.extracted_interests,
  };
}

/**
 * Analyze CV using Backend AI Service (ai_v2 pipeline)
 * Replaces direct OpenRouter calls with multi-agent analysis
 * Only method for CV analysis - no client-side fallbacks
 */
async function analyzeCvWithBackend(
  pdfBase64: string,
  userId: string,
  cvId?: string,
  fileName?: string
): Promise<OpenRouterAnalysis> {
  // Import BackendConfig for endpoint URL
  const BackendConfig = (await import('../../config/backend')).default;
  const endpoint = BackendConfig.endpoints.cvAnalysis();
  
  BackendConfig.logCall('CVAnalysis', endpoint, { userId, pdfSize: pdfBase64.length });
  
  const response = await fetch(endpoint, {
    method: "POST",
    headers: BackendConfig.getHeaders(),
    body: JSON.stringify({
      pdf_base64: pdfBase64,
      user_id: userId,
      cv_id: cvId,
      file_name: fileName,
    }),
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    const errorMsg = errorData.error || `Backend returned ${response.status}`;
    BackendConfig.logError('CVAnalysis', `Backend error (${response.status}): ${errorMsg}`);
    throw new Error(`Backend analysis failed: ${errorMsg}`);
  }

  const json = await response.json();
  
  if (!json.success || !json.data) {
    BackendConfig.logError('CVAnalysis', 'Invalid backend response format');
    throw new Error("Invalid backend response format");
  }

  const normalizedData: OpenRouterAnalysis = {
    ...json.data,
    extracted_skills: normalizeStringArray(
      json.data.extracted_skills ??
      json.data.extracted_evidence?.skills
    ),
    extracted_interests: normalizeStringArray(
      json.data.extracted_interests ??
      json.data.profile_updates?.interests
    ),
    career_suggestions: Array.isArray(json.data.career_suggestions)
      ? json.data.career_suggestions
      : [],
    ats_issues: Array.isArray(json.data.ats_issues)
      ? json.data.ats_issues
      : [],
    ats_suggestions: Array.isArray(json.data.ats_suggestions)
      ? json.data.ats_suggestions
      : [],
  };
  
  BackendConfig.logSuccess('CVAnalysis', {
    ats_score: normalizedData.ats_score,
    skills: normalizedData.extracted_skills?.length || 0,
    careers: normalizedData.career_suggestions?.length || 0,
  });

  return normalizedData;
}

/**
 * Analyze CV using OpenRouter API (free tier compatible)
 * Now routes through backend service for unified ai_v2 pipeline
 */
async function analyzeWithOpenRouter(
  pdfBase64: string,
  fileName: string
): Promise<OpenRouterAnalysis> {
  logDebug(`[cv-analysis] Starting CV analysis via backend...`);

  try {
    // Get current user for backend call
    const { data: { session }, error: sessionError } = await supabase.auth.getSession();
    if (sessionError || !session) {
      throw new Error('Not authenticated - cannot analyze CV');
    }

    const userId = session.user?.id;
    if (!userId) {
      throw new Error('No user ID available for analysis');
    }

    logDebug(`[cv-analysis] Attempting backend analysis for user: ${userId}`);
    return await analyzeCvWithBackend(pdfBase64, userId, undefined, fileName);
    
  } catch (err) {
    console.error(`[cv-analysis] ❌ Analysis failed:`, err);
    // Propagate error - do NOT fall back to mock data
    throw err;
  }
}

/**
 * Save analysis results to Supabase
 */
async function saveAnalysisToDatabase(
  cvId: string,
  userId: string,
  analysis: OpenRouterAnalysis
): Promise<CvAnalysis> {
  logDebug(`[cv-analysis] Saving analysis to database...`);

  try {
    const insertPayload = {
      cv_upload_id: cvId,
      user_id: userId,
      ats_score: analysis.ats_score,
      ats_issues: analysis.ats_issues,
      suggested_improvements: analysis.ats_suggestions,
      career_suggestions: analysis.career_suggestions,
      extracted_skills: analysis.extracted_skills,
      extracted_interests: analysis.extracted_interests,
    };

    const { data, error } = await supabase
      .from("cv_analysis")
      .insert(insertPayload)
      .select()
      .single();

    if (error) {
      const message = String(error.message || "").toLowerCase();
      const missingExtractedColumns =
        message.includes("extracted_skills") || message.includes("extracted_interests");

      if (missingExtractedColumns) {
        console.warn(
          `[cv-analysis] ℹ️ Extracted fields columns missing in cv_analysis table, saving without them.`
        );

        const { data: fallbackData, error: fallbackError } = await supabase
          .from("cv_analysis")
          .insert({
            cv_upload_id: cvId,
            user_id: userId,
            ats_score: analysis.ats_score,
            ats_issues: analysis.ats_issues,
            suggested_improvements: analysis.ats_suggestions,
            career_suggestions: analysis.career_suggestions,
          })
          .select()
          .single();

        if (fallbackError) {
          console.error(`[cv-analysis] ❌ Database fallback save failed:`, fallbackError);
          throw fallbackError;
        }

        return {
          ...(fallbackData as CvAnalysis),
          extracted_skills: analysis.extracted_skills,
          extracted_interests: analysis.extracted_interests,
        };
      }

      console.error(`[cv-analysis] ❌ Database save failed:`, error);
      throw error;
    }

    logDebug(`[cv-analysis] ✅ Analysis saved to database:`, data);
    return data as CvAnalysis;
  } catch (err) {
    console.error(`[cv-analysis] ❌ Failed to save analysis:`, err);
    throw err;
  }
}

async function getExistingAnalysis(cvId: string, userId: string): Promise<CvAnalysis | null> {
  const { data, error } = await supabase
    .from("cv_analysis")
    .select("*")
    .eq("cv_upload_id", cvId)
    .eq("user_id", userId)
    .order("created_at", { ascending: false })
    .limit(1)
    .single();

  if (error) {
    if (error.code === "PGRST116") {
      return null;
    }

    console.warn(`[cv-analysis] Could not read existing analysis cache, continuing with fresh analysis`, {
      code: error.code,
      message: error.message,
    });
    return null;
  }

  const cachedExtracted = await getCachedExtractedFields(cvId);
  return mergeExtractedFields(data as CvAnalysis, cachedExtracted);
}

/**
 * Main function: Analyze CV end-to-end
 * 1. Download PDF from storage
 * 2. Extract text
 * 3. Call OpenRouter API
 * 4. Save results to database
 */
export async function analyzeCvWithOpenRouter(
  cvId: string,
  storagePath: string,
  fileName: string
): Promise<CvAnalysis> {
  console.log(`[CV_TRIGGER] analyzeCvWithOpenRouter called for: cvId=${cvId}, fileName=${fileName}`);
  console.log(`[cv-analysis] 🚀 Starting CV analysis: ${fileName}`);

  try {
    // Get current user
    const { data: { session }, error: sessionError } = await supabase.auth.getSession();
    if (sessionError || !session) {
      throw new Error("Not authenticated - no session");
    }

    const userId = session.user?.id;

    if (!userId) {
      throw new Error("Missing user ID");
    }

    // ⭐ CHECK CACHE FIRST - BEFORE ANY PDF PROCESSING
    console.log(`[cv-analysis] 🔍 Checking for existing cached analysis...`);
    const cachedAnalysis = await getExistingAnalysis(cvId, userId);
    // Only use cache if it has actual extracted skills (not from failed/empty run)
    // AND timestamp is fresh (within 24 hours)
    const cacheAge = cachedAnalysis ? Date.now() - new Date(cachedAnalysis.created_at).getTime() : 0;
    const isCacheFresh = cacheAge < 24 * 60 * 60 * 1000; // 24 hours
    if (cachedAnalysis && 
        cachedAnalysis.extracted_skills && 
        cachedAnalysis.extracted_skills.length > 0 &&
        isCacheFresh) {
      console.warn(`[cv-analysis] ♻️ Using cached analysis for this CV (returning immediately, no PDF processing)`);
      console.log(`[cv-analysis] ✅ Cached analysis found with ${cachedAnalysis.extracted_skills.length} skills (${Math.round(cacheAge / (60 * 1000))} min old) - returning without re-analysis`);
      return cachedAnalysis;
    }
    
    // Cached analysis exists but has 0 skills or is stale - treat as invalid cache, will re-analyze
    if (cachedAnalysis && (!cachedAnalysis.extracted_skills || cachedAnalysis.extracted_skills.length === 0)) {
      console.warn(`[cv-analysis] ⚠️ Cached analysis has 0 skills (likely from failed run) - will re-analyze`);
    }
    if (cachedAnalysis && !isCacheFresh) {
      console.warn(`[cv-analysis] ⚠️ Cached analysis is stale (${Math.round(cacheAge / (60 * 60 * 1000))} hours old) - will re-analyze`);
    }

    // Step 1: Download PDF (returns base64)
    console.log(`[cv-analysis] 📥 Step 1: Downloading PDF...`);
    const pdfBase64 = await downloadPdfFromStorage(storagePath);

    // Step 2: Analyze with backend (send raw base64 for Claude document vision)
    console.log(`[cv-analysis] 🤖 Step 2: Analyzing with backend...`);
    const analysis = await analyzeWithOpenRouter(pdfBase64, fileName);

    await cacheExtractedFields(cvId, {
      extracted_skills: analysis.extracted_skills,
      extracted_interests: analysis.extracted_interests,
    });

    // Step 4: Save to database
    console.log(`[cv-analysis] 💾 Step 4: Saving results...`);
    const savedAnalysis = await saveAnalysisToDatabase(cvId, userId, analysis);

    console.log(`[cv-analysis] ✅ CV analysis complete!`);
    return savedAnalysis;
  } catch (err) {
    console.error(`[cv-analysis] ❌ Analysis pipeline failed:`, err);
    throw err;
  }
}
