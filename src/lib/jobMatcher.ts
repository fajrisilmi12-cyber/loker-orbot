/**
 * Job Matcher & Qualification Filter Module
 * Inspects job titles and job descriptions against dealbreakers, negative keywords,
 * and calculates a match percentage score before clicking Apply.
 */

export interface MatchEvaluationResult {
  shouldApply: boolean;
  score: number; // 0 to 100
  reason: string;
  matchedKeywords: string[];
  rejectedKeyword?: string;
}

export interface JobMatcherOptions {
  jobTitle: string;
  company: string;
  jobDescription?: string;
  targetKeywords?: string;
  negativeKeywords?: string;
  minScoreThreshold?: number;
  candidateSkills?: string;
}

export function evaluateJobMatch(options: JobMatcherOptions): MatchEvaluationResult {
  const {
    jobTitle,
    company,
    jobDescription = '',
    targetKeywords = '',
    negativeKeywords = '',
    minScoreThreshold = 60,
    candidateSkills = ''
  } = options;

  const fullText = `${jobTitle} ${company} ${jobDescription}`.toLowerCase();

  // 1. FAST DEALBREAKER / NEGATIVE KEYWORDS CHECK
  if (negativeKeywords) {
    const blacklisted = negativeKeywords
      .split(/[,;\n]+/)
      .map(k => k.trim().toLowerCase())
      .filter(Boolean);

    for (const badWord of blacklisted) {
      if (badWord.length > 2 && fullText.includes(badWord)) {
        return {
          shouldApply: false,
          score: 0,
          reason: `Mengandung kata kunci terlarang (Blacklist): "${badWord}"`,
          matchedKeywords: [],
          rejectedKeyword: badWord
        };
      }
    }
  }

  // 2. KEYWORD RELEVANCE & SCORING
  let score = 50; // Base score for reaching the search results
  const matched: string[] = [];

  // Parse positive search keywords
  const positiveList = targetKeywords
    .split(/[,;\n]+/)
    .map(k => k.trim().toLowerCase())
    .filter(Boolean);

  for (const pos of positiveList) {
    if (jobTitle.toLowerCase().includes(pos)) {
      score += 25;
      matched.push(pos);
    } else if (jobDescription.toLowerCase().includes(pos)) {
      score += 10;
      matched.push(pos);
    }
  }

  // Parse candidate skills
  const skillsList = candidateSkills
    .split(/[,;\n]+/)
    .map(k => k.trim().toLowerCase())
    .filter(Boolean);

  let skillsHit = 0;
  for (const skill of skillsList) {
    if (skill.length > 2 && fullText.includes(skill)) {
      skillsHit++;
      if (!matched.includes(skill)) matched.push(skill);
    }
  }

  // Boost by skills overlap (up to +25)
  score += Math.min(25, skillsHit * 5);

  // Experience level heuristics
  if (/(intern|internship|magang|junior|fresh graduate|entry level)/i.test(jobTitle)) {
    score += 5;
  }
  if (/(lead|head of|vp|director|manager|principal)/i.test(jobTitle) && !/(senior|lead)/i.test(candidateSkills)) {
    score -= 20;
  }

  const finalScore = Math.max(0, Math.min(100, score));
  const passes = finalScore >= minScoreThreshold;

  return {
    shouldApply: passes,
    score: finalScore,
    reason: passes 
      ? `Skor kecocokan memenuhi syarat (${finalScore}% >= ${minScoreThreshold}%)` 
      : `Skor kecocokan di bawah batas minimal (${finalScore}% < ${minScoreThreshold}%)`,
    matchedKeywords: matched
  };
}
