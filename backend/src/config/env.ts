import dotenv from 'dotenv';

dotenv.config();

function required(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return value;
}

const publicBackendUrl =
  process.env.PUBLIC_BACKEND_URL || `http://localhost:${Number(process.env.PORT) || 4000}`;

export const env = {
  port: Number(process.env.PORT) || 4000,
  nodeEnv: process.env.NODE_ENV || 'development',
  frontendUrl: process.env.FRONTEND_URL || 'http://localhost:5173',
  // The publicly reachable URL for this backend (e.g. an ngrok/production domain) —
  // used for the Meta webhook URL and the OAuth redirect URI.
  publicBackendUrl,

  supabaseUrl: required('SUPABASE_URL'),
  supabaseAnonKey: required('SUPABASE_ANON_KEY'),
  supabaseServiceRoleKey: required('SUPABASE_SERVICE_ROLE_KEY'),

  // Key used to encrypt stored access tokens (AES-256-GCM). Falls back to a
  // key derived from the service role key so encryption always works.
  tokenEncryptionKey: process.env.TOKEN_ENCRYPTION_KEY || '',

  meta: {
    appId: process.env.META_APP_ID || '',
    appSecret: process.env.META_APP_SECRET || '',
    verifyToken: process.env.META_VERIFY_TOKEN || '',
    pageAccessToken: process.env.META_PAGE_ACCESS_TOKEN || '',
    redirectUri: process.env.META_REDIRECT_URI || `${publicBackendUrl}/api/meta/callback`,
  },
  whatsapp: {
    phoneNumberId: process.env.WHATSAPP_PHONE_NUMBER_ID || '',
    accessToken: process.env.WHATSAPP_ACCESS_TOKEN || '',
    verifyToken: process.env.WHATSAPP_VERIFY_TOKEN || '',
  },
};
