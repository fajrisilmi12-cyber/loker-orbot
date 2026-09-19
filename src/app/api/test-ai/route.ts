import { NextResponse } from 'next/server';
import { testAiConnection } from '@/lib/aiGateway';

export const dynamic = 'force-dynamic';

export async function POST(request: Request) {
  try {
    let body: any = null;
    try {
      body = await request.json();
    } catch {}

    const result = await testAiConnection(body?.endpoint);
    if (result.success) {
      return NextResponse.json({ success: true, message: result.message, reply: result.reply });
    } else {
      return NextResponse.json({ success: false, error: result.message }, { status: 400 });
    }
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error?.message || 'Gagal terhubung ke AI' }, { status: 500 });
  }
}
