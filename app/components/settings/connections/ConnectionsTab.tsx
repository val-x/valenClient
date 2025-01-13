import React, { useState, useEffect } from 'react';
import { toast } from 'react-toastify';
import Cookies from 'js-cookie';
import { logStore } from '~/lib/stores/logs';
import { Client, Account } from 'appwrite';

interface GitHubUserResponse {
  login: string;
  id: number;
  [key: string]: any;
}

export default function ConnectionsTab() {
  const [githubUsername, setGithubUsername] = useState(Cookies.get('githubUsername') || '');
  const [githubToken, setGithubToken] = useState(Cookies.get('githubToken') || '');
  const [isConnected, setIsConnected] = useState(false);
  const [isVerifying, setIsVerifying] = useState(false);

  // Appwrite states
  const [appwriteEndpoint, setAppwriteEndpoint] = useState(Cookies.get('appwriteEndpoint') || '');
  const [appwriteProjectId, setAppwriteProjectId] = useState(Cookies.get('appwriteProjectId') || '');
  const [appwriteApiKey, setAppwriteApiKey] = useState(Cookies.get('appwriteApiKey') || '');
  const [isAppwriteConnected, setIsAppwriteConnected] = useState(false);
  const [isAppwriteVerifying, setIsAppwriteVerifying] = useState(false);

  // Supabase states
  const [isSupabaseConnected, setIsSupabaseConnected] = useState(false);
  const [isSupabaseVerifying, setIsSupabaseVerifying] = useState(false);
  const [authWindow, setAuthWindow] = useState<Window | null>(null);

  useEffect(() => {
    // Check if credentials exist and verify them
    if (githubUsername && githubToken) {
      verifyGitHubCredentials();
    }

    if (appwriteEndpoint && appwriteProjectId && appwriteApiKey) {
      verifyAppwriteCredentials();
    }

    // Check if we have a Supabase access token
    const supabaseAccessToken = Cookies.get('supabaseAccessToken');

    if (supabaseAccessToken) {
      verifySupabaseConnection(supabaseAccessToken);
    }

    // Check for access_token in URL hash
    const hashParams = new URLSearchParams(window.location.hash.substring(1));
    const accessToken = hashParams.get('access_token');
    const state = hashParams.get('state');

    if (accessToken && state) {
      const storedState = sessionStorage.getItem('supabase_auth_state');

      if (state === storedState) {
        verifySupabaseConnection(accessToken).then((isValid) => {
          if (isValid) {
            Cookies.set('supabaseAccessToken', accessToken, { expires: 30 });
            toast.success('Successfully connected to Supabase');
          }
        });
      } else {
        toast.error('Invalid state parameter. Please try again.');
      }

      // Clean up URL and state
      window.history.replaceState({}, document.title, window.location.pathname);
      sessionStorage.removeItem('supabase_auth_state');
    }

    // Listen for messages from the popup window
    const handleMessage = async (event: MessageEvent) => {
      // Only handle messages from trusted origins
      if (event.origin !== 'https://supabase.com') {
        return;
      }

      try {
        if (event.data?.type === 'supabase_token') {
          const { accessToken } = event.data;

          if (accessToken) {
            Cookies.set('supabaseAccessToken', accessToken, { expires: 30 });

            const isValid = await verifySupabaseConnection(accessToken);

            if (isValid) {
              toast.success('Successfully connected to Supabase');
              authWindow?.close();
            }
          }
        }
      } catch (error) {
        console.error('Error handling auth message:', error);
        toast.error('Failed to complete authentication');
      }
    };

    window.addEventListener('message', handleMessage);

    return () => window.removeEventListener('message', handleMessage);
  }, [authWindow]);

  const verifyGitHubCredentials = async () => {
    setIsVerifying(true);

    try {
      const response = await fetch('https://api.github.com/user', {
        headers: {
          Authorization: `Bearer ${githubToken}`,
        },
      });

      if (response.ok) {
        const data = (await response.json()) as GitHubUserResponse;

        if (data.login === githubUsername) {
          setIsConnected(true);
          return true;
        }
      }

      setIsConnected(false);

      return false;
    } catch (error) {
      console.error('Error verifying GitHub credentials:', error);
      setIsConnected(false);

      return false;
    } finally {
      setIsVerifying(false);
    }
  };

  const handleSaveConnection = async () => {
    if (!githubUsername || !githubToken) {
      toast.error('Please provide both GitHub username and token');
      return;
    }

    setIsVerifying(true);

    const isValid = await verifyGitHubCredentials();

    if (isValid) {
      Cookies.set('githubUsername', githubUsername);
      Cookies.set('githubToken', githubToken);
      logStore.logSystem('GitHub connection settings updated', {
        username: githubUsername,
        hasToken: !!githubToken,
      });
      toast.success('GitHub credentials verified and saved successfully!');
      Cookies.set('git:github.com', JSON.stringify({ username: githubToken, password: 'x-oauth-basic' }));
      setIsConnected(true);
    } else {
      toast.error('Invalid GitHub credentials. Please check your username and token.');
    }
  };

  const handleDisconnect = () => {
    Cookies.remove('githubUsername');
    Cookies.remove('githubToken');
    Cookies.remove('git:github.com');
    setGithubUsername('');
    setGithubToken('');
    setIsConnected(false);
    logStore.logSystem('GitHub connection removed');
    toast.success('GitHub connection removed successfully!');
  };

  const verifyAppwriteCredentials = async () => {
    setIsAppwriteVerifying(true);

    try {
      const client = new Client();
      client.setEndpoint(appwriteEndpoint).setProject(appwriteProjectId);

      const account = new Account(client);
      await account.get();

      setIsAppwriteConnected(true);

      return true;
    } catch (error) {
      console.error('Error verifying Appwrite credentials:', error);
      setIsAppwriteConnected(false);

      return false;
    } finally {
      setIsAppwriteVerifying(false);
    }
  };

  const handleSaveAppwriteConnection = async () => {
    if (!appwriteEndpoint || !appwriteProjectId || !appwriteApiKey) {
      toast.error('Please provide all Appwrite credentials');
      return;
    }

    setIsAppwriteVerifying(true);

    const isValid = await verifyAppwriteCredentials();

    if (isValid) {
      Cookies.set('appwriteEndpoint', appwriteEndpoint);
      Cookies.set('appwriteProjectId', appwriteProjectId);
      Cookies.set('appwriteApiKey', appwriteApiKey);
      logStore.logSystem('Appwrite connection settings updated', {
        endpoint: appwriteEndpoint,
        projectId: appwriteProjectId,
      });
      toast.success('Appwrite credentials verified and saved successfully!');
      setIsAppwriteConnected(true);
    } else {
      toast.error('Invalid Appwrite credentials. Please check your endpoint, project ID, and API key.');
    }
  };

  const handleDisconnectAppwrite = () => {
    Cookies.remove('appwriteEndpoint');
    Cookies.remove('appwriteProjectId');
    Cookies.remove('appwriteApiKey');
    setAppwriteEndpoint('');
    setAppwriteProjectId('');
    setAppwriteApiKey('');
    setIsAppwriteConnected(false);
    logStore.logSystem('Appwrite connection removed');
    toast.success('Appwrite connection removed successfully!');
  };

  // TODO: This is not working error : Authorization window was closed. Please try again.
  const verifySupabaseConnection = async (accessToken: string) => {
    setIsSupabaseVerifying(true);

    try {
      const response = await fetch('https://api.supabase.com/v1/organizations', {
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
      });

      if (!response.ok) {
        const errorData = (await response.json().catch(() => ({}))) as { message?: string };
        throw new Error(errorData.message || 'Failed to verify Supabase connection');
      }

      setIsSupabaseConnected(true);

      return true;
    } catch (error) {
      console.error('Error verifying Supabase connection:', error);
      setIsSupabaseConnected(false);
      Cookies.remove('supabaseAccessToken');
      toast.error(error instanceof Error ? error.message : 'Failed to verify Supabase connection');

      return false;
    } finally {
      setIsSupabaseVerifying(false);
    }
  };

  const initiateSupabaseAuth = () => {
    try {
      // Generate a random auth_id
      const authId = crypto.randomUUID();
      sessionStorage.setItem('supabase_auth_id', authId);

      // Calculate popup window position
      const width = 1000;
      const height = 800;
      const left = window.screenX + (window.outerWidth - width) / 2;
      const top = window.screenY + (window.outerHeight - height) / 2;

      // Use the Supabase Dashboard authorize endpoint
      const authUrl = `https://supabase.com/dashboard/authorize?auth_id=${authId}`;

      // Open popup window to Supabase authorization
      const popup = window.open(
        authUrl,
        'SupabaseAuth',
        `width=${width},height=${height},left=${left},top=${top},popup=1,toolbar=0,location=1,menubar=0`,
      );

      if (popup) {
        setAuthWindow(popup);

        // Check if popup was blocked or closed
        const checkPopup = setInterval(() => {
          try {
            // This will throw if the popup was closed
            if (!popup || popup.closed) {
              clearInterval(checkPopup);
              setAuthWindow(null);
              sessionStorage.removeItem('supabase_auth_id');

              if (!isSupabaseConnected) {
                toast.error('Authorization window was closed. Please try again.');
              }
            } else {
              // Check if the popup URL contains the access token
              try {
                const popupLocation = popup.location;
                const popupSearch = popupLocation.search;
                const params = new URLSearchParams(popupSearch);
                const returnedAuthId = params.get('auth_id');

                if (returnedAuthId === authId) {
                  // Exchange auth_id for access token
                  fetch('https://api.supabase.com/v1/token', {
                    method: 'POST',
                    headers: {
                      'Content-Type': 'application/json',
                    },
                    body: JSON.stringify({
                      grant_type: 'authorization_code',
                      auth_id: authId,
                    }),
                  })
                    .then((response) => response.json())
                    .then((data: unknown) => {
                      const tokenData = data as { access_token?: string };

                      if (tokenData.access_token) {
                        Cookies.set('supabaseAccessToken', tokenData.access_token, { expires: 30 });
                        verifySupabaseConnection(tokenData.access_token).then((isValid) => {
                          if (isValid) {
                            toast.success('Successfully connected to Supabase');
                            popup.close();
                          }
                        });
                      } else {
                        throw new Error('No access token received');
                      }
                    })
                    .catch((error) => {
                      console.error('Error exchanging auth_id for token:', error);
                      toast.error('Failed to complete authentication');
                    })
                    .finally(() => {
                      clearInterval(checkPopup);
                      setAuthWindow(null);
                      sessionStorage.removeItem('supabase_auth_id');
                    });
                }
              } catch {
                // Ignore cross-origin errors while checking location
              }
            }
          } catch (error: unknown) {
            // Ignore cross-origin errors when checking popup location
            const errorMessage = error instanceof Error ? error.toString() : String(error);

            if (!errorMessage.includes('cross-origin')) {
              console.error('Error checking popup status:', error);
            }
          }
        }, 500);
      } else {
        toast.error('Popup was blocked. Please allow popups and try again.');
      }
    } catch (error: unknown) {
      console.error('Error initiating Supabase authentication:', error);
      toast.error('Failed to initiate Supabase authentication');
      sessionStorage.removeItem('supabase_auth_id');
    }
  };

  const handleDisconnectSupabase = () => {
    Cookies.remove('supabaseAccessToken');
    setIsSupabaseConnected(false);
    logStore.logSystem('Supabase connection removed');
    toast.success('Supabase connection removed successfully!');
  };

  return (
    <div className="space-y-4">
      <div className="p-4 mb-4 border border-bolt-elements-borderColor rounded-lg bg-bolt-elements-background-depth-3">
        <h3 className="text-lg font-medium text-bolt-elements-textPrimary mb-4">GitHub Connection</h3>
        <div className="flex mb-4">
          <div className="flex-1 mr-2">
            <label className="block text-sm text-bolt-elements-textSecondary mb-1">GitHub Username:</label>
            <input
              type="text"
              value={githubUsername}
              onChange={(e) => setGithubUsername(e.target.value)}
              disabled={isVerifying}
              className="w-full bg-white dark:bg-bolt-elements-background-depth-4 relative px-2 py-1.5 rounded-md focus:outline-none placeholder-bolt-elements-textTertiary text-bolt-elements-textPrimary dark:text-bolt-elements-textPrimary border border-bolt-elements-borderColor disabled:opacity-50"
            />
          </div>
          <div className="flex-1">
            <label className="block text-sm text-bolt-elements-textSecondary mb-1">Personal Access Token:</label>
            <input
              type="password"
              value={githubToken}
              onChange={(e) => setGithubToken(e.target.value)}
              disabled={isVerifying}
              className="w-full bg-white dark:bg-bolt-elements-background-depth-4 relative px-2 py-1.5 rounded-md focus:outline-none placeholder-bolt-elements-textTertiary text-bolt-elements-textPrimary dark:text-bolt-elements-textPrimary border border-bolt-elements-borderColor disabled:opacity-50"
            />
          </div>
        </div>
        <div className="flex mb-4 items-center">
          {!isConnected ? (
            <button
              onClick={handleSaveConnection}
              disabled={isVerifying || !githubUsername || !githubToken}
              className="bg-bolt-elements-button-primary-background rounded-lg px-4 py-2 mr-2 transition-colors duration-200 hover:bg-bolt-elements-button-primary-backgroundHover text-bolt-elements-button-primary-text disabled:opacity-50 disabled:cursor-not-allowed flex items-center"
            >
              {isVerifying ? (
                <>
                  <div className="i-ph:spinner animate-spin mr-2" />
                  Verifying...
                </>
              ) : (
                'Connect'
              )}
            </button>
          ) : (
            <button
              onClick={handleDisconnect}
              className="bg-bolt-elements-button-danger-background rounded-lg px-4 py-2 mr-2 transition-colors duration-200 hover:bg-bolt-elements-button-danger-backgroundHover text-bolt-elements-button-danger-text"
            >
              Disconnect
            </button>
          )}
          {isConnected && (
            <span className="text-sm text-green-600 flex items-center">
              <div className="i-ph:check-circle mr-1" />
              Connected to GitHub
            </span>
          )}
        </div>
      </div>

      <div className="p-4 border border-bolt-elements-borderColor rounded-lg bg-bolt-elements-background-depth-3">
        <h3 className="text-lg font-medium text-bolt-elements-textPrimary mb-4 flex items-center">
          Appwrite Connection
          <span className="ml-2 text-xs px-2 py-0.5 bg-bolt-elements-button-primary-background text-bolt-elements-button-primary-text rounded-full">
            Beta
          </span>
        </h3>
        <div className="space-y-4">
          <div className="flex-1">
            <label className="block text-sm text-bolt-elements-textSecondary mb-1">Endpoint:</label>
            <input
              type="text"
              value={appwriteEndpoint}
              onChange={(e) => setAppwriteEndpoint(e.target.value)}
              disabled={isAppwriteVerifying}
              placeholder="https://cloud.appwrite.io/v1"
              className="w-full bg-white dark:bg-bolt-elements-background-depth-4 relative px-2 py-1.5 rounded-md focus:outline-none placeholder-bolt-elements-textTertiary text-bolt-elements-textPrimary dark:text-bolt-elements-textPrimary border border-bolt-elements-borderColor disabled:opacity-50"
            />
          </div>
          <div className="flex-1">
            <label className="block text-sm text-bolt-elements-textSecondary mb-1">Project ID:</label>
            <input
              type="text"
              value={appwriteProjectId}
              onChange={(e) => setAppwriteProjectId(e.target.value)}
              disabled={isAppwriteVerifying}
              className="w-full bg-white dark:bg-bolt-elements-background-depth-4 relative px-2 py-1.5 rounded-md focus:outline-none placeholder-bolt-elements-textTertiary text-bolt-elements-textPrimary dark:text-bolt-elements-textPrimary border border-bolt-elements-borderColor disabled:opacity-50"
            />
          </div>
          <div className="flex-1">
            <label className="block text-sm text-bolt-elements-textSecondary mb-1">API Key:</label>
            <input
              type="password"
              value={appwriteApiKey}
              onChange={(e) => setAppwriteApiKey(e.target.value)}
              disabled={isAppwriteVerifying}
              className="w-full bg-white dark:bg-bolt-elements-background-depth-4 relative px-2 py-1.5 rounded-md focus:outline-none placeholder-bolt-elements-textTertiary text-bolt-elements-textPrimary dark:text-bolt-elements-textPrimary border border-bolt-elements-borderColor disabled:opacity-50"
            />
          </div>
        </div>
        <div className="flex mt-4 items-center">
          {!isAppwriteConnected ? (
            <button
              onClick={handleSaveAppwriteConnection}
              disabled={isAppwriteVerifying || !appwriteEndpoint || !appwriteProjectId || !appwriteApiKey}
              className="bg-bolt-elements-button-primary-background rounded-lg px-4 py-2 mr-2 transition-colors duration-200 hover:bg-bolt-elements-button-primary-backgroundHover text-bolt-elements-button-primary-text disabled:opacity-50 disabled:cursor-not-allowed flex items-center"
            >
              {isAppwriteVerifying ? (
                <>
                  <div className="i-ph:spinner animate-spin mr-2" />
                  Verifying...
                </>
              ) : (
                'Connect'
              )}
            </button>
          ) : (
            <button
              onClick={handleDisconnectAppwrite}
              className="bg-bolt-elements-button-danger-background rounded-lg px-4 py-2 mr-2 transition-colors duration-200 hover:bg-bolt-elements-button-danger-backgroundHover text-bolt-elements-button-danger-text"
            >
              Disconnect
            </button>
          )}
          {isAppwriteConnected && (
            <span className="text-sm text-green-600 flex items-center">
              <div className="i-ph:check-circle mr-1" />
              Connected to Appwrite
            </span>
          )}
        </div>
      </div>

      <div className="p-4 border border-bolt-elements-borderColor rounded-lg bg-bolt-elements-background-depth-3">
        <h3 className="text-lg font-medium text-bolt-elements-textPrimary mb-4 flex items-center">
          Supabase Connection
          <span className="ml-2 text-xs px-2 py-0.5 bg-bolt-elements-button-primary-background text-bolt-elements-button-primary-text rounded-full">
            Beta
          </span>
        </h3>
        <div className="space-y-4">
          <p className="text-sm text-bolt-elements-textSecondary mb-4">
            Connect your Supabase account to access your organization projects and resources.
          </p>
        </div>
        <div className="flex mt-4 items-center">
          {!isSupabaseConnected ? (
            <button
              onClick={initiateSupabaseAuth}
              disabled={isSupabaseVerifying}
              className="bg-bolt-elements-button-primary-background rounded-lg px-4 py-2 mr-2 transition-colors duration-200 hover:bg-bolt-elements-button-primary-backgroundHover text-bolt-elements-button-primary-text disabled:opacity-50 disabled:cursor-not-allowed flex items-center"
            >
              {isSupabaseVerifying ? (
                <>
                  <div className="i-ph:spinner animate-spin mr-2" />
                  Verifying...
                </>
              ) : (
                <>
                  <div className="i-ph:sign-in mr-2" />
                  Connect with Supabase Dashboard
                </>
              )}
            </button>
          ) : (
            <button
              onClick={handleDisconnectSupabase}
              className="bg-bolt-elements-button-danger-background rounded-lg px-4 py-2 mr-2 transition-colors duration-200 hover:bg-bolt-elements-button-danger-backgroundHover text-bolt-elements-button-danger-text"
            >
              Disconnect
            </button>
          )}
          {isSupabaseConnected && (
            <span className="text-sm text-green-600 flex items-center">
              <div className="i-ph:check-circle mr-1" />
              Connected to Supabase
            </span>
          )}
        </div>
      </div>
    </div>
  );
}
