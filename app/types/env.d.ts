interface Window {
  ENV?: {
    env: {
      SUPABASE_CLIENT_ID: string;
      SUPABASE_CLIENT_SECRET: string;
    };
    isSupabaseConfigured: boolean;
  };
}
