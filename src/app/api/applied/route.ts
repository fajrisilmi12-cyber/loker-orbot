import { NextResponse } from 'next/server';
import { getAppliedJobs, exportAppliedJobsCsv, testActiveStorage } from '@/lib/storage';
import { getConfig } from '@/lib/config';

export const dynamic = 'force-dynamic';

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
