import { NextResponse } from 'next/server';
import { getConfig, saveConfig } from '@/lib/config';
import { initializeSheet } from '@/lib/googleSheets';

export async function GET() {
  const config = getConfig();
  return NextResponse.json({ success: true, config, ...config });
}

export async function POST(request: Request) {
  try {
    const body = await request.json();

    // Backend Validation
    if (body.fullName !== undefined && typeof body.fullName === 'string' && !body.fullName.trim()) {
      return NextResponse.json({ success: false, error: 'Nama Lengkap wajib diisi' }, { status: 400 });
    }

    if (body.phoneNumber !== undefined && typeof body.phoneNumber === 'string' && !body.phoneNumber.trim()) {
      return NextResponse.json({ success: false, error: 'Nomor Telepon wajib diisi' }, { status: 400 });
    }

    if (body.skills !== undefined && typeof body.skills === 'string' && !body.skills.trim()) {
      return NextResponse.json({ success: false, error: 'Daftar keahlian kerja wajib diisi' }, { status: 400 });
    }

    if (body.concurrency !== undefined) {
      const num = Number(body.concurrency);
      if (isNaN(num) || num < 1 || num > 8) {
        return NextResponse.json({ success: false, error: 'Worker konkuren harus antara 1 dan 8' }, { status: 400 });
      }
    }

    if (body.googleCredentialsJson && typeof body.googleCredentialsJson === 'string' && body.googleCredentialsJson.trim()) {
      try {
        JSON.parse(body.googleCredentialsJson);
      } catch {
        return NextResponse.json({ success: false, error: 'Google Credentials harus berupa JSON valid' }, { status: 400 });
      }
    }

    const updated = saveConfig(body);

    // If Google Sheet config is provided, initialize headers in the background without blocking the save response
    if (updated.spreadsheetId && updated.googleCredentialsJson) {
      initializeSheet().catch((sheetError) => {
        console.warn('Could not initialize Google Sheet headers yet:', sheetError?.message || sheetError);
      });
    }

    return NextResponse.json({ success: true, config: updated, message: 'Konfigurasi berhasil disimpan!' });
  } catch (error: unknown) {
    const errMsg = error instanceof Error ? error.message : 'Terjadi kesalahan sistem';
    return NextResponse.json({ success: false, error: errMsg }, { status: 400 });
  }
}
