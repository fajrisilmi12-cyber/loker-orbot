/**
 * Universal Search Query & Native Filter Builder for Job Portals
 * Formats multi-keyword inputs and advanced criteria into native URL parameters
 * for JobStreet, Glints, LinkedIn, and Indeed.
 */

export interface ParsedSearchCriteria {
  keywords: string[];
  primaryKeyword: string;
  booleanKeywords: string;
  primaryLocation: string;
  allLocations: string[];
}

export function parseKeywords(rawKeywords: string = ''): string[] {
  if (!rawKeywords) return [];
  const parts = rawKeywords
    .split(/[,;\n|]+/)
    .map((k) => k.trim())
    .filter((k) => k.length >= 2);

  // Deduplicate while preserving order
  const unique: string[] = [];
  for (const p of parts) {
    if (!unique.some((u) => u.toLowerCase() === p.toLowerCase())) {
      unique.push(p);
    }
  }
  return unique;
}

export function parseLocations(rawLocations: string = ''): { primaryLocation: string; allLocations: string[] } {
  if (!rawLocations) return { primaryLocation: '', allLocations: [] };
  const parts = rawLocations
    .split(/[,;\n|]+/)
    .map((l) => l.trim())
    .filter(Boolean);

  const primary = parts.find((p) => !/remote|wfh|any/i.test(p)) || parts[0] || '';
  return {
    primaryLocation: primary,
    allLocations: parts,
  };
}

export function buildJobstreetSearchUrl(config: any): { url: string; displayKeywords: string } {
  const keywordsList = parseKeywords(config.searchKeywords);
  const { primaryLocation } = parseLocations(config.location);

  const searchParams = new URLSearchParams();

  let displayKeywords = '';
  if (keywordsList.length === 1) {
    searchParams.set('keywords', keywordsList[0]);
    displayKeywords = keywordsList[0];
  } else if (keywordsList.length > 1) {
    // Top 4 keywords as Boolean query
    const topKeywords = keywordsList.slice(0, 4);
    const booleanQuery = topKeywords.map((k) => (k.includes(' ') ? `"${k}"` : k)).join(' OR ');
    searchParams.set('keywords', booleanQuery);
    displayKeywords = booleanQuery;
  }

  if (primaryLocation && primaryLocation.toLowerCase() !== 'all') {
    searchParams.set('where', primaryLocation);
  }

  // Native Date Posted filter (createdAt)
  const dateMap: Record<string, string> = {
    '24h': '1d',
    'week': '7d',
    'month': '30d',
  };
  if (config.datePosted && dateMap[config.datePosted]) {
    searchParams.set('createdAt', dateMap[config.datePosted]);
  }

  // Native Job Type filter (workType)
  const jobTypeMap: Record<string, string> = {
    'full_time': 'full-time',
    'part_time': 'part-time',
    'contract': 'contract',
    'freelance': 'casual',
    'internship': 'internship',
  };
  const workTypes = (config.jobType || [])
    .map((t: string) => jobTypeMap[t])
    .filter(Boolean);
  if (workTypes.length > 0) {
    searchParams.set('workType', workTypes.join(','));
  }

  const queryString = searchParams.toString();
  const url = queryString
    ? `https://id.jobstreet.com/id/jobs?${queryString}`
    : 'https://id.jobstreet.com/id/jobs';

  return { url, displayKeywords };
}

export function buildGlintsSearchUrl(config: any): { url: string; displayKeywords: string } {
  const keywordsList = parseKeywords(config.searchKeywords);
  const { primaryLocation } = parseLocations(config.location);

  const searchParams = new URLSearchParams();
  searchParams.set('country', 'ID');

  let displayKeywords = '';
  if (keywordsList.length > 0) {
    // Glints prefers clean single term or primary focused term
    const primary = keywordsList[0];
    searchParams.set('keyword', primary);
    displayKeywords = primary;
  }

  if (primaryLocation && primaryLocation.toLowerCase() !== 'all') {
    searchParams.set('locationName', primaryLocation);
  } else {
    searchParams.set('locationName', 'All Cities/Provinces');
  }

  // Native Job Types
  if (config.jobType && config.jobType.length > 0) {
    const glintsJobTypeMap: Record<string, string> = {
      'full_time': 'FULL_TIME',
      'part_time': 'PART_TIME',
      'contract': 'CONTRACT',
      'internship': 'INTERNSHIP',
      'freelance': 'FREELANCE',
    };
    const jt = config.jobType.map((t: string) => glintsJobTypeMap[t]).filter(Boolean);
    if (jt.length > 0) searchParams.set('jobTypes', jt.join(','));
  }

  // Native Work Location Mode (Remote / Hybrid / Onsite)
  if (config.workMode && config.workMode.length > 0) {
    const modeMap: Record<string, string> = {
      'remote': 'REMOTE',
      'hybrid': 'HYBRID',
      'onsite': 'ONSITE',
    };
    const wm = config.workMode.map((m: string) => modeMap[m]).filter(Boolean);
    if (wm.length > 0) searchParams.set('workLocationTypes', wm.join(','));
  }

  const url = `https://glints.com/id/opportunities/jobs/explore?${searchParams.toString()}`;
  return { url, displayKeywords };
}

export function buildLinkedinSearchUrl(config: any): { url: string; displayKeywords: string } {
  const keywordsList = parseKeywords(config.searchKeywords);
  const { primaryLocation } = parseLocations(config.location);

  const searchParams = new URLSearchParams();

  let displayKeywords = '';
  if (keywordsList.length === 1) {
    searchParams.set('keywords', keywordsList[0]);
    displayKeywords = keywordsList[0];
  } else if (keywordsList.length > 1) {
    const topKeywords = keywordsList.slice(0, 4);
    const booleanQuery = topKeywords.map((k) => (k.includes(' ') ? `"${k}"` : k)).join(' OR ');
    searchParams.set('keywords', booleanQuery);
    displayKeywords = booleanQuery;
  }

  if (primaryLocation) searchParams.set('location', primaryLocation);
  searchParams.set('f_AL', 'true'); // Filter Easy Apply
  searchParams.set('origin', 'JOB_SEARCH_PAGE_SEARCH_BUTTON');
  searchParams.set('refresh', 'true');

  // Filter Date Posted
  const datePostedMap: Record<string, string> = {
    '24h': 'r86400',
    'week': 'r604800',
    'month': 'r2592000',
  };
  if (config.datePosted && datePostedMap[config.datePosted]) {
    searchParams.set('f_TPR', datePostedMap[config.datePosted]);
  }

  // Filter Job Type
  const jobTypeMap: Record<string, string> = {
    'full_time': 'F',
    'part_time': 'P',
    'contract': 'C',
    'internship': 'I',
    'freelance': 'T',
  };
  const jobTypeValues = (config.jobType || []).map((t: string) => jobTypeMap[t]).filter(Boolean);
  if (jobTypeValues.length > 0) {
    searchParams.set('f_JT', jobTypeValues.join(','));
  }

  // Filter Workplace Mode
  const workModeMap: Record<string, string> = {
    'onsite': '1',
    'remote': '2',
    'hybrid': '3',
  };
  const workModeValues = (config.workMode || []).map((m: string) => workModeMap[m]).filter(Boolean);
  if (workModeValues.length > 0) {
    searchParams.set('f_WT', workModeValues.join(','));
  }

  // Filter Experience Level
  const expLevelMap: Record<string, string> = {
    'fresh': '1',
    '1-3': '2',
    '3-5': '3',
    '5+': '4',
  };
  const expValues = (config.experienceLevel || []).map((e: string) => expLevelMap[e]).filter(Boolean);
  if (expValues.length > 0) {
    searchParams.set('f_E', expValues.join(','));
  }

  const url = `https://www.linkedin.com/jobs/search/?${searchParams.toString()}`;
  return { url, displayKeywords };
}

export function buildIndeedSearchUrl(config: any): { url: string; displayKeywords: string } {
  const keywordsList = parseKeywords(config.searchKeywords);
  const { primaryLocation } = parseLocations(config.location);
  const location = primaryLocation || 'Indonesia';

  if (config.indeedNoJobTitleFilter) {
    const locParam = encodeURIComponent(location.toLowerCase());
    const url = `https://id.indeed.com/jobs?q=&l=${locParam}&from=searchOnHP`;
    return { url, displayKeywords: '(Semua Job Title)' };
  }

  const searchParams = new URLSearchParams();

  let displayKeywords = '';
  if (keywordsList.length === 1) {
    const qVal = keywordsList[0].includes(' ') ? `title:("${keywordsList[0]}")` : `title:(${keywordsList[0]})`;
    searchParams.set('q', qVal);
    displayKeywords = qVal;
  } else if (keywordsList.length > 1) {
    const topKeywords = keywordsList.slice(0, 4);
    const titleQuery = `title:(${topKeywords.map((k) => (k.includes(' ') ? `"${k}"` : k)).join(' OR ')})`;
    searchParams.set('q', titleQuery);
    displayKeywords = titleQuery;
  }

  if (location) searchParams.set('l', location);
  searchParams.set('radius', '25');
  searchParams.set('from', 'searchOnDesktopSerp');

  // Filter Date Posted
  const datePostedMap: Record<string, string> = {
    '24h': '1',
    'week': '7',
    'month': '30',
  };
  if (config.datePosted && datePostedMap[config.datePosted]) {
    searchParams.set('fromage', datePostedMap[config.datePosted]);
  }

  // Filter Job Type
  const jobTypeMap: Record<string, string> = {
    'full_time': 'fulltime',
    'part_time': 'parttime',
    'contract': 'contract',
    'internship': 'internship',
    'freelance': 'temporary',
  };
  const jtValues = (config.jobType || []).map((t: string) => jobTypeMap[t]).filter(Boolean);
  if (jtValues.length > 0) {
    searchParams.set('jt', jtValues[0]);
  }

  if ((config.workMode || []).includes('remote')) {
    searchParams.set('remotejob', '1');
  }

  const url = `https://id.indeed.com/jobs?${searchParams.toString()}`;
  return { url, displayKeywords };
}
