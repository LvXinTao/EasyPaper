import { NextResponse } from 'next/server';

export async function GET() {
  return NextResponse.json({
    status: 'ok',
    app: 'EasyPaper',
    version: process.env.npm_package_version || '1.0.0',
  });
}

export async function HEAD() {
  return new NextResponse(null, {
    status: 200,
    headers: {
      'X-App': 'EasyPaper',
    },
  });
}