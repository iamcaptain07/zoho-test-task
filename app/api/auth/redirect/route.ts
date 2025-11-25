import { NextResponse } from 'next/server';

export async function GET() {
  const clientId = process.env.ZOHO_CLIENT_ID;
  const redirectUri = process.env.ZOHO_REDIRECT_URI || 'http://localhost:3000/api/auth/callback';

  if (!clientId) {
    return NextResponse.json({ error: 'ZOHO_CLIENT_ID not configured' }, { status: 500 });
  }

  const authUrl = `https://accounts.zoho.com/oauth/v2/auth?scope=ZohoCRM.modules.ALL&client_id=${clientId}&response_type=code&access_type=offline&redirect_uri=${encodeURIComponent(redirectUri)}`;

  return NextResponse.json({ authUrl });
}

