export interface TalentCandidate {
  id: string;
  name: string;
  headline: string;
  platform: 'linkedin' | 'glints' | 'jobstreet';
  profileUrl: string;
  location: string;
  phone?: string;
  email?: string;
  contact?: string;
  whatsappUrl?: string;
  isOpenToWork: boolean;
  openToWorkDetails?: {
    positions?: string[];
    locations?: string[];
    startDate?: string;
    jobTypes?: string[];
    workplaceTypes?: string[]; // On-site, Hybrid, Remote
  };
  currentRole?: string;
  currentCompany?: string;
  experienceYears?: number;
  experiences: Array<{
    title: string;
    company: string;
    duration: string;
    startDate?: string;
    endDate?: string;
    description?: string;
    isOverlappingSuspicious?: boolean;
  }>;
  skills: string[];
  education?: Array<{
    school: string;
    degree?: string;
    fieldOfStudy?: string;
    period?: string;
    activities?: string;
  }>;
  activityHighlights?: string[];
  tenureAnalysis?: {
    averageTenureYears?: number;
    stabilityRating: 'high' | 'moderate' | 'low';
    notes: string;
  };
  aiHonestyScore: number; // 0 - 100
  aiHonestyNotes: string[];
  aiMatchScore: number; // 0 - 100
  availabilityStatus: 'immediate' | '1_month_notice' | 'employed' | 'unknown';
  sourcedDate: string;
  status: 'new' | 'contacted' | 'interviewing' | 'rejected' | 'hired';
  notes?: string;
}

export interface TalentFilter {
  targetRole: string;
  locations: string[];
  minExperienceYears?: number;
  onlyOpenToWork: boolean;
  platforms: Array<'linkedin' | 'glints' | 'jobstreet'>;
  searchMethod: 'xray' | 'puppeteer_stealth';
  requireContact: boolean; // Phone or Email
}

export interface XRaySearchResult {
  title: string;
  snippet: string;
  url: string;
  parsedName?: string;
  parsedHeadline?: string;
  parsedLocation?: string;
  extractedPhone?: string;
  extractedEmail?: string;
}

export interface ParsedTalentPrompt {
  originalPrompt: string;
  primaryRole: string;
  roleSynonyms: string[];
  locations: string[];
  skills: string[];
  seniority?: 'fresh_graduate' | 'junior' | 'mid' | 'senior' | 'any';
  availability?: 'immediate' | '1_month_notice' | 'any';
  requireContact: boolean;
  queries: {
    linkedin: string;
    glints: string;
    webResumePdf: string;
  };
}
