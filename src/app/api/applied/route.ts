import { NextResponse } from 'next/server';
import { getAppliedJobs, exportAppliedJobsCsv, testActiveStorage, addAppliedJob } from '@/lib/storage';
import { getConfig } from '@/lib/config';

export const dynamic = 'force-dynamic';

export async function OPTIONS() {
  return new NextResponse(null, {
    status: 200,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    }
  });
}

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const exportType = searchParams.get('export');

    if (exportType === 'csv') {
      const csvData = await exportAppliedJobsCsv();
      return new NextResponse(csvData, {
        headers: {
          'Content-Type': 'text/csv; charset=utf-8',
          'Content-Disposition': `attachment; filename="cv-blaster-applied-jobs-${new Date().toISOString().slice(0, 10)}.csv"`,
        },
      });
    }

    const config = getConfig();
    const list = await getAppliedJobs(searchParams.get('refresh') === 'true');
    const storageInfo = await testActiveStorage();

    return NextResponse.json({
      success: true,
      storageType: config.storageType || 'sqlite',
      storageInfo: storageInfo.message,
      data: list,
    });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    if (!body.company || !body.title || !body.jobUrl) {
      return NextResponse.json(
        { success: false, error: 'company, title, dan jobUrl wajib diisi' },
        { status: 400 }
      );
    }

    await addAppliedJob(body);
    return NextResponse.json({
      success: true,
      message: `Lamaran untuk ${body.title} di ${body.company} berhasil dicatat!`
    });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
