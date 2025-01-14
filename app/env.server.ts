export function getEnvConfig() {
  return {
    env: {
      SUPABASE_CLIENT_ID: process.env.SUPABASE_CLIENT_ID,
      SUPABASE_CLIENT_SECRET: process.env.SUPABASE_CLIENT_SECRET,
    },
    isSupabaseConfigured: Boolean(process.env.SUPABASE_CLIENT_ID && process.env.SUPABASE_CLIENT_SECRET),
  };
}

// Type guard to ensure environment variables are set
export function validateEnv() {
  const requiredEnvVars = ['SUPABASE_CLIENT_ID', 'SUPABASE_CLIENT_SECRET'];
  const missingEnvVars = requiredEnvVars.filter((envVar) => !process.env[envVar]);

  if (missingEnvVars.length > 0) {
    throw new Error(`Missing required environment variables: ${missingEnvVars.join(', ')}`);
  }
}
