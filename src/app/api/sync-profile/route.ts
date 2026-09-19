import { NextRequest } from 'next/server';
import { syncGlintsProfile } from '@/lib/profileSync';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  const responseStream = new TransformStream();
  const writer = responseStream.writable.getWriter();
  const encoder = new TextEncoder();

  const sendLog = async (message: string) => {
    try {
      await writer.write(
        encoder.encode(`data: ${JSON.stringify({ type: 'log', message, timestamp: new Date().toISOString() })}\n\n`)
      );
    } catch (err) {
      console.warn('SSE client disconnected:', err);
    }
  };

  const sendEvent = async (type: string, data: any) => {
    try {
      await writer.write(
        encoder.encode(`data: ${JSON.stringify({ type, data, timestamp: new Date().toISOString() })}\n\n`)
      );
    } catch (err) {
      console.warn('SSE client disconnected:', err);
    }
  };

  (async () => {
    try {
      await syncGlintsProfile(
        async (msg) => {
          await sendLog(msg);
        },
        async (profile) => {
          await sendEvent('profile_detected', profile);
        }
      );
    } catch (err: any) {
      await sendLog(`🚨 Fatal error: ${err.message || err}`);
    } finally {
      try {
        await writer.close();
      } catch (e) {}
    }
  })();

  return new Response(responseStream.readable, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache, no-transform',
      'Connection': 'keep-alive',
    },
  });
}
