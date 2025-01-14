import { useEffect } from 'react';
import { useSearchParams } from '@remix-run/react';
import Cookies from 'js-cookie';

interface SupabaseOrg {
  id: string;
  name: string;
  billing_email: string;
}

// Add type guard for token response
const validateTokenResponse = (data: unknown): data is TokenExchangeResponse => {
  return Boolean(
    data &&
      typeof (data as TokenExchangeResponse).access_token === 'string' &&
      typeof (data as TokenExchangeResponse).refresh_token === 'string' &&
      typeof (data as TokenExchangeResponse).expires_in === 'number' &&
      typeof (data as TokenExchangeResponse).token_type === 'string',
  );
};

// Add these interfaces for better type safety
interface TokenExchangeResponse {
  access_token: string;
  refresh_token: string;
  expires_in: number;
  token_type: string;
}

interface SupabaseConfig {
  clientId: string;
  clientSecret: string;
  redirectUri: string;
}

// Add helper to get Supabase config
const getSupabaseConfig = (): SupabaseConfig | null => {
  const { env } = (window as Window).ENV || {};

  if (!env?.SUPABASE_CLIENT_ID || !env?.SUPABASE_CLIENT_SECRET) {
    return null;
  }

  return {
    clientId: env.SUPABASE_CLIENT_ID,
    clientSecret: env.SUPABASE_CLIENT_SECRET,
    redirectUri: `${window.location.origin}/auth/callback`,
  };
};

// Add this interface for better error handling
interface SupabaseError {
  message: string;
  status?: number;
}

// Update the token exchange function with better error handling
const exchangeCodeForToken = async (code: string): Promise<TokenExchangeResponse> => {
  const config = getSupabaseConfig();

  if (!config) {
    throw new Error('Missing Supabase configuration');
  }

  try {
    const response = await fetch('https://api.supabase.com/v1/token', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        Accept: 'application/json',
      },
      body: new URLSearchParams({
        grant_type: 'authorization_code',
        code,
        client_id: config.clientId,
        client_secret: config.clientSecret,
        redirect_uri: config.redirectUri,
      }).toString(),
    });

    const data = await response.json();

    if (!response.ok) {
      const error = data as SupabaseError;
      throw new Error(error.message || `Token exchange failed: ${response.statusText}`);
    }

    if (!validateTokenResponse(data)) {
      throw new Error('Invalid token response format');
    }

    return data;
  } catch (error) {
    console.error('Token exchange error:', error);
    throw error;
  }
};

// Add the fetchOrganizations function
const fetchOrganizations = async (accessToken: string): Promise<SupabaseOrg[]> => {
  const response = await fetch('https://api.supabase.com/v1/organizations', {
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
  });

  if (!response.ok) {
    throw new Error(`Failed to fetch organizations: ${response.statusText}`);
  }

  const orgs = await response.json();

  if (!Array.isArray(orgs)) {
    throw new Error('Invalid organizations response format');
  }

  return orgs.map((org) => ({
    id: org.id,
    name: org.name,
    billing_email: org.billing_email,
  }));
};

export default function AuthCallback() {
  const [searchParams] = useSearchParams();

  useEffect(() => {
    const handleAuth = async () => {
      try {
        const code = searchParams.get('code');
        const state = searchParams.get('state');
        const error = searchParams.get('error');
        const storedState = sessionStorage.getItem('supabaseAuthState');

        if (error) {
          throw new Error(`Auth error: ${error}`);
        }

        if (!code || !state || state !== storedState) {
          throw new Error('Invalid state or missing code');
        }

        // Exchange code for token
        const tokenData = await exchangeCodeForToken(code);

        // Store tokens securely with proper domain settings
        Cookies.set('supabaseAccessToken', tokenData.access_token, {
          secure: true,
          sameSite: 'strict',
          expires: new Date(Date.now() + tokenData.expires_in * 1000),
          path: '/',
          domain: window.location.hostname,
        });

        // Get organizations with proper auth header
        const orgs = await fetchOrganizations(tokenData.access_token);

        // Send success message with complete data
        window.opener?.postMessage(
          {
            type: 'supabaseAuthSuccess',
            accessToken: tokenData.access_token,
            refreshToken: tokenData.refresh_token,
            tokenType: tokenData.token_type,
            expiresIn: tokenData.expires_in,
            orgId: orgs[0]?.id,
            orgs,
          },
          window.location.origin,
        );

        // Clean up
        sessionStorage.removeItem('supabaseAuthState');
        setTimeout(() => window.close(), 1000);
      } catch (error) {
        console.error('Auth error:', error);
        window.opener?.postMessage(
          {
            type: 'supabaseAuthError',
            error: error instanceof Error ? error.message : 'Authentication failed',
          },
          window.location.origin,
        );
      }
    };

    handleAuth();
  }, [searchParams]);

  return (
    <div className="flex flex-col items-center justify-center min-h-screen gap-4 bg-bolt-background text-bolt-elements-textPrimary">
      <div className="i-ph:spinner animate-spin text-4xl" />
      <div className="text-lg">Completing authentication...</div>
    </div>
  );
}
