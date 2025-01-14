export function getEnvConfig() {
  return {
    env: {
      SUPABASE_CLIENT_ID: process.env.SUPABASE_CLIENT_ID || '',
      SUPABASE_CLIENT_SECRET: process.env.SUPABASE_CLIENT_SECRET || '',
    },
    isSupabaseConfigured: Boolean(process.env.SUPABASE_CLIENT_ID && process.env.SUPABASE_CLIENT_SECRET),
  };
}

// Type guard to ensure environment variables are set
export function validateEnv() {
  // No required environment variables for now
  return true;
}
