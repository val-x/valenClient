import React, { useState, useEffect } from 'react';
import { toast } from 'react-toastify';
import Cookies from 'js-cookie';
import { logStore } from '~/lib/stores/logs';
import { Client, Account } from 'appwrite';
import { createClient } from '@supabase/supabase-js';

interface GitHubUserResponse {
  login: string;
  id: number;
  [key: string]: any;
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
  const [supabaseUrl, setSupabaseUrl] = useState(Cookies.get('supabaseUrl') || '');
  const [supabaseKey, setSupabaseKey] = useState(Cookies.get('supabaseKey') || '');
  const [isSupabaseConnected, setIsSupabaseConnected] = useState(false);
  const [isSupabaseVerifying, setIsSupabaseVerifying] = useState(false);

  useEffect(() => {
    // Check if credentials exist and verify them
    if (githubUsername && githubToken) {
      verifyGitHubCredentials();
    }

    if (appwriteEndpoint && appwriteProjectId && appwriteApiKey) {
      verifyAppwriteCredentials();
    }

    if (supabaseUrl && supabaseKey) {
      verifySupabaseCredentials();
    }
  }, []);

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

  const verifySupabaseCredentials = async () => {
    setIsSupabaseVerifying(true);

    try {
      const supabase = createClient(supabaseUrl, supabaseKey);
      const { error } = await supabase.auth.getSession();

      if (error) {
        throw error;
      }

      setIsSupabaseConnected(true);

      return true;
    } catch (error) {
      console.error('Error verifying Supabase credentials:', error);
      setIsSupabaseConnected(false);

      return false;
    } finally {
      setIsSupabaseVerifying(false);
    }
  };

  const handleSaveSupabaseConnection = async () => {
    if (!supabaseUrl || !supabaseKey) {
      toast.error('Please provide both Supabase URL and API key');
      return;
    }

    setIsSupabaseVerifying(true);

    const isValid = await verifySupabaseCredentials();

    if (isValid) {
      Cookies.set('supabaseUrl', supabaseUrl);
      Cookies.set('supabaseKey', supabaseKey);
      logStore.logSystem('Supabase connection settings updated', {
        url: supabaseUrl,
        hasKey: !!supabaseKey,
      });
      toast.success('Supabase credentials verified and saved successfully!');
      setIsSupabaseConnected(true);
    } else {
      toast.error('Invalid Supabase credentials. Please check your URL and API key.');
    }
  };

  const handleDisconnectSupabase = () => {
    Cookies.remove('supabaseUrl');
    Cookies.remove('supabaseKey');
    setSupabaseUrl('');
    setSupabaseKey('');
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
          <div className="flex-1">
            <label className="block text-sm text-bolt-elements-textSecondary mb-1">Project URL:</label>
            <input
              type="text"
              value={supabaseUrl}
              onChange={(e) => setSupabaseUrl(e.target.value)}
              disabled={isSupabaseVerifying}
              placeholder="https://your-project.supabase.co"
              className="w-full bg-white dark:bg-bolt-elements-background-depth-4 relative px-2 py-1.5 rounded-md focus:outline-none placeholder-bolt-elements-textTertiary text-bolt-elements-textPrimary dark:text-bolt-elements-textPrimary border border-bolt-elements-borderColor disabled:opacity-50"
            />
          </div>
          <div className="flex-1">
            <label className="block text-sm text-bolt-elements-textSecondary mb-1">API Key:</label>
            <input
              type="password"
              value={supabaseKey}
              onChange={(e) => setSupabaseKey(e.target.value)}
              disabled={isSupabaseVerifying}
              placeholder="your-supabase-anon-key"
              className="w-full bg-white dark:bg-bolt-elements-background-depth-4 relative px-2 py-1.5 rounded-md focus:outline-none placeholder-bolt-elements-textTertiary text-bolt-elements-textPrimary dark:text-bolt-elements-textPrimary border border-bolt-elements-borderColor disabled:opacity-50"
            />
          </div>
        </div>
        <div className="flex mt-4 items-center">
          {!isSupabaseConnected ? (
            <button
              onClick={handleSaveSupabaseConnection}
              disabled={isSupabaseVerifying || !supabaseUrl || !supabaseKey}
              className="bg-bolt-elements-button-primary-background rounded-lg px-4 py-2 mr-2 transition-colors duration-200 hover:bg-bolt-elements-button-primary-backgroundHover text-bolt-elements-button-primary-text disabled:opacity-50 disabled:cursor-not-allowed flex items-center"
            >
              {isSupabaseVerifying ? (
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
