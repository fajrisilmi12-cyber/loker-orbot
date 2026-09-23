/**
 * Job Matcher & Qualification Filter Module (SaaS Agnostic)
 * Evaluates job compatibility dynamically based strictly on user-defined:
 * - targetKeywords (e.g. "Full Stack Developer", "Digital Marketing", "Financial Auditor", "Civil Engineer")
 * - candidateSkills (e.g. "React, Node.js" or "SEO, Copywriting, Google Ads" or "SAP, IFRS, Tax")
 * - negativeKeywords (user's custom dealbreakers / blacklist)
 * - minScoreThreshold (0-100%)
 *
 * NO HARDCODED INDUSTRY TERMS - Works universally for any profession/niche.
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
  blacklistedCompanies?: string;
  minScoreThreshold?: number;
  candidateSkills?: string;
}

const COMMON_STOP_WORDS = new Set([
  'dan', 'atau', 'di', 'ke', 'dari', 'untuk', 'pada', 'dengan', 'yang', 'ini', 'itu',
  'and', 'or', 'in', 'on', 'at', 'to', 'for', 'with', 'by', 'from', 'the', 'a', 'an', 'of',
  'pt', 'cv', 'tbk', 'ltd', 'inc', 'corp', 'co'
]);

export function evaluateJobMatch(options: JobMatcherOptions): MatchEvaluationResult {
  const {
    jobTitle = '',
    company = '',
    jobDescription = '',
    targetKeywords = '',
    negativeKeywords = '',
    blacklistedCompanies = '',
    minScoreThreshold = 50,
    candidateSkills = ''
  } = options;

  const normalizedTitle = jobTitle.toLowerCase();
  const normalizedDesc = jobDescription.toLowerCase();
  const fullText = `${normalizedTitle} ${company.toLowerCase()} ${normalizedDesc}`;

  // 0. COMPANY BLACKLIST CHECK (Avoid current employer or specific agencies)
  if (blacklistedCompanies && company) {
    const blacklistedList = blacklistedCompanies
      .split(/[,;\n]+/)
      .map(c => c.trim().toLowerCase())
      .filter(c => c.length >= 2);

    const normCompany = company.toLowerCase().trim();
    for (const badComp of blacklistedList) {
      if (normCompany.includes(badComp) || badComp.includes(normCompany)) {
        return {
          shouldApply: false,
          score: 0,
          reason: `Perusahaan masuk daftar Blacklist: "${company}" (Cocok dengan: "${badComp}")`,
          matchedKeywords: [],
          rejectedKeyword: badComp,
        };
      }
    }
  }

  // 1. FAST DEALBREAKER / NEGATIVE KEYWORDS CHECK (Custom User Blacklist)
  if (negativeKeywords) {
    const blacklisted = negativeKeywords
      .split(/[,;\n]+/)
      .map(k => k.trim().toLowerCase())
      .filter(k => k.length >= 2);

    for (const badWord of blacklisted) {
      if (fullText.includes(badWord)) {
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

  // 2. DYNAMIC TARGET KEYWORDS SCORING (Max 55 Points)
  // Evaluates how well the Job Title & Description match what the user is searching for.
  const targetPhrases = targetKeywords
    .split(/[,;\n]+/)
    .map(k => k.trim().toLowerCase())
    .filter(k => k.length >= 2);

  const matched: string[] = [];
  let titleScore = 0;
  let descScore = 0;

  if (targetPhrases.length > 0) {
    let exactTitleMatch = false;
    let partialTitleHits = 0;
    let targetTokensCount = 0;

    for (const phrase of targetPhrases) {
      const cleanPhraseNoSpace = phrase.replace(/\s+/g, '');
      const cleanTitleNoSpace = normalizedTitle.replace(/\s+/g, '');
      const cleanDescNoSpace = normalizedDesc.replace(/\s+/g, '');

      // Exact full phrase in title (e.g., "Full Stack Developer" in "Senior Full Stack Developer" or "Fullstack")
      if (normalizedTitle.includes(phrase) || (cleanPhraseNoSpace.length >= 5 && cleanTitleNoSpace.includes(cleanPhraseNoSpace))) {
        exactTitleMatch = true;
        if (!matched.includes(phrase)) matched.push(phrase);
      } else if (normalizedDesc.includes(phrase) || (cleanPhraseNoSpace.length >= 5 && cleanDescNoSpace.includes(cleanPhraseNoSpace))) {
        descScore += 10;
        if (!matched.includes(phrase)) matched.push(phrase);
      }

      // Individual keyword token matching (e.g. "Full", "Stack", "Developer")
      const words = phrase
        .split(/\s+/)
        .map(w => w.replace(/[^a-z0-9+#.-]/g, '').trim())
        .filter(w => w.length >= 2 && !COMMON_STOP_WORDS.has(w));

      targetTokensCount += words.length;
      for (const word of words) {
        if (normalizedTitle.includes(word)) {
          partialTitleHits++;
          if (!matched.includes(word)) matched.push(word);
        }
      }
    }

    if (exactTitleMatch) {
      titleScore = 50;
    } else if (targetTokensCount > 0 && partialTitleHits > 0) {
      const tokenRatio = Math.min(1, partialTitleHits / targetTokensCount);
      titleScore = Math.round(tokenRatio * 40);
    }
  } else {
    // If user provided no target keywords, default neutral baseline for title
    titleScore = 25;
  }

  // 3. CANDIDATE SKILLS OVERLAP (Max 35 Points)
  // Evaluates how many of the candidate's skills appear in the job requirements / title
  const skillTokens = candidateSkills
    .split(/[,;\n/]+/)
    .map(s => s.trim().toLowerCase())
    .filter(s => s.length >= 2);

  let skillsHitCount = 0;
  if (skillTokens.length > 0) {
    for (const skill of skillTokens) {
      // Match skill in full text
      if (fullText.includes(skill)) {
        skillsHitCount++;
        if (!matched.includes(skill)) matched.push(skill);
      }
    }
    // Proportional skill points: each hit gives up to 7 points (capped at 35)
    const skillScore = Math.min(35, skillsHitCount * 7);
    descScore += skillScore;
  } else {
    // If user has not filled skills, give neutral baseline
    descScore += 15;
  }

  // 4. EXPERIENCE / SENIORITY RELEVANCE (Max 10 Points adjustment)
  let seniorityAdjustment = 0;
  const isSeniorJob = /\b(lead|head|vp|director|manager|principal|chief|senior|sr\.?)\b/i.test(normalizedTitle);
  const isCandidateSenior = /\b(senior|lead|head|manager|principal)\b/i.test(candidateSkills.toLowerCase()) ||
                            /\b(senior|lead|head|manager|principal)\b/i.test(targetKeywords.toLowerCase());

  if (isSeniorJob && !isCandidateSenior) {
    seniorityAdjustment -= 15; // Penalty for applying to high management when candidate isn't targeted for it
  } else if (!isSeniorJob && /\b(intern|internship|magang|junior|fresh|entry)\b/i.test(normalizedTitle)) {
    seniorityAdjustment += 10;
  }

  // Calculate Total Dynamic Score (0 - 100)
  const totalScore = Math.max(0, Math.min(100, titleScore + descScore + seniorityAdjustment));
  const passes = totalScore >= minScoreThreshold;

  return {
    shouldApply: passes,
    score: totalScore,
    reason: passes
      ? `Skor kecocokan memenuhi syarat (${totalScore}% >= ${minScoreThreshold}%)`
      : `Skor kecocokan di bawah batas minimal (${totalScore}% < ${minScoreThreshold}%)`,
    matchedKeywords: matched
  };
}
