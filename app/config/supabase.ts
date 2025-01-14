import { json } from '@remix-run/cloudflare';

export interface SupabaseEnv {
  SUPABASE_CLIENT_ID: string;
  SUPABASE_CLIENT_SECRET: string;
}

export const supabaseConfig = {
  apiUrl: 'https://api.supabase.com',
  getClientConfig: () => {
    // Check if we're in the browser
    if (typeof window !== 'undefined' && window.ENV?.env) {
      return {
        clientId: window.ENV.env.SUPABASE_CLIENT_ID,
        clientSecret: window.ENV.env.SUPABASE_CLIENT_SECRET,
      };
    }

    // Return empty strings for server-side
    return {
      clientId: '',
      clientSecret: '',
    };
  },
};

// Validate configuration
export const validateSupabaseConfig = () => {
  const config = supabaseConfig.getClientConfig();
  const missingVars = [];

  if (!config.clientId) {
    missingVars.push('SUPABASE_CLIENT_ID');
  }

  if (!config.clientSecret) {
    missingVars.push('SUPABASE_CLIENT_SECRET');
  }

  return {
    isValid: missingVars.length === 0,
    missingVars,
  };
};

// Load environment variables on the server side
export async function getSupabaseEnv(_request: Request, context: any) {
  const env = {
    SUPABASE_CLIENT_ID: context.SUPABASE_CLIENT_ID || '',
    SUPABASE_CLIENT_SECRET: context.SUPABASE_CLIENT_SECRET || '',
  };

  return json({ env });
}
