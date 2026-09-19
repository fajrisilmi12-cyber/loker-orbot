import fs from 'fs';
import path from 'path';
import { TalentCandidate } from './talentTypes';

const TALENT_STORAGE_PATH = path.join(process.cwd(), 'sourced_talents.json');

export function getSourcedTalents(): TalentCandidate[] {
  try {
    if (!fs.existsSync(TALENT_STORAGE_PATH)) {
      return [];
    }
    const raw = fs.readFileSync(TALENT_STORAGE_PATH, 'utf-8');
    return JSON.parse(raw);
  } catch (err) {
    console.error('Failed to read sourced talents:', err);
    return [];
  }
}

export function saveSourcedTalents(talents: TalentCandidate[]): boolean {
  try {
    fs.writeFileSync(TALENT_STORAGE_PATH, JSON.stringify(talents, null, 2), 'utf-8');
    return true;
  } catch (err) {
    console.error('Failed to write sourced talents:', err);
    return false;
  }
}

export function upsertCandidate(candidate: TalentCandidate): boolean {
  const current = getSourcedTalents();
  const existingIdx = current.findIndex(c => c.profileUrl === candidate.profileUrl || c.id === candidate.id);
  
  if (existingIdx >= 0) {
    current[existingIdx] = { ...current[existingIdx], ...candidate };
  } else {
    current.unshift(candidate);
  }
  
  return saveSourcedTalents(current);
}

export function exportTalentsToCsv(talents: TalentCandidate[]): string {
  const headers = [
    'Nama Lengkap',
    'Headline',
    'Platform',
    'Open to Work',
    'Domisili / Lokasi',
    'Nomor WhatsApp',
    'Email',
    'Ketersediaan',
    'Skor Kejujuran AI',
    'Catatan AI',
    'URL Profil',
    'Tanggal Scraping'
  ];

  const rows = talents.map(t => [
    `"${(t.name || '').replace(/"/g, '""')}"`,
    `"${(t.headline || '').replace(/"/g, '""')}"`,
    `"${t.platform}"`,
    t.isOpenToWork ? 'YA' : 'TIDAK',
    `"${(t.location || '').replace(/"/g, '""')}"`,
    `"${t.phone || '-'}"`,
    `"${t.email || '-'}"`,
    `"${t.availabilityStatus}"`,
    `${t.aiHonestyScore}%`,
    `"${(t.aiHonestyNotes || []).join('; ').replace(/"/g, '""')}"`,
    `"${t.profileUrl}"`,
    `"${t.sourcedDate}"`
  ]);

  return [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
}
