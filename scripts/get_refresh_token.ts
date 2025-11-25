import axios from 'axios';
import * as readline from 'readline';

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout,
});

function question(query: string): Promise<string> {
  return new Promise(resolve => rl.question(query, resolve));
}

async function main() {
  const clientId = process.env.ZOHO_CLIENT_ID || await question('Enter ZOHO_CLIENT_ID: ');
  const clientSecret = process.env.ZOHO_CLIENT_SECRET || await question('Enter ZOHO_CLIENT_SECRET: ');
  const redirectUri = process.env.ZOHO_REDIRECT_URI || await question('Enter ZOHO_REDIRECT_URI: ');

  const authUrl = `https://accounts.zoho.com/oauth/v2/auth?scope=ZohoCRM.modules.ALL&client_id=${clientId}&response_type=code&access_type=offline&redirect_uri=${encodeURIComponent(redirectUri)}`;

  console.log('\n1. Visit this URL in your browser:');
  console.log(authUrl);
  console.log('\n2. Authorize the application');
  console.log('3. Copy the authorization code from the redirect URL');
  console.log('   (it will be in the "code" parameter)\n');

  const code = await question('Enter the authorization code: ');

  try {
    const params = new URLSearchParams();
    params.append('grant_type', 'authorization_code');
    params.append('client_id', clientId);
    params.append('client_secret', clientSecret);
    params.append('redirect_uri', redirectUri);
    params.append('code', code);

    const resp = await axios.post('https://accounts.zoho.com/oauth/v2/token', params);
    const data = resp.data;

    console.log('\n✅ Success! Add this to your .env file:');
    console.log(`ZOHO_REFRESH_TOKEN=${data.refresh_token}`);
    console.log('\nAccess token expires in:', data.expires_in, 'seconds');
  } catch (e: any) {
    console.error('Error:', e.response?.data || e.message);
  }

  rl.close();
}

main();

