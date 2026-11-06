import { NextResponse } from 'next/server';

export async function GET() {
  return NextResponse.json({
    service: 'niva-web',
    status: 'healthy',
    timestamp: new Date().toISOString(),
    version: '0.1.0',
  });
}
