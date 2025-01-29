import { useStore } from '@nanostores/react';
import { motion, type HTMLMotionProps, type Variants } from 'framer-motion';
import { computed } from 'nanostores';
import { memo, useCallback, useEffect, useState, useRef } from 'react';
import { toast } from 'react-toastify';
import {
  type OnChangeCallback as OnEditorChange,
  type OnScrollCallback as OnEditorScroll,
} from '~/components/editor/codemirror/CodeMirrorEditor';
import { IconButton } from '~/components/ui/IconButton';
import { PanelHeaderButton } from '~/components/ui/PanelHeaderButton';
import { Slider, type SliderOptions } from '~/components/ui/Slider';
import { workbenchStore, type WorkbenchViewType } from '~/lib/stores/workbench';
import { classNames } from '~/utils/classNames';
import { cubicEasingFn } from '~/utils/easings';
import { renderLogger } from '~/utils/logger';
import { EditorPanel } from './EditorPanel';
import { Preview } from './Preview';
import useViewport from '~/lib/hooks';
import Cookies from 'js-cookie';
import { SiSupabase } from 'react-icons/si';
import { SettingsWindow } from '~/components/settings/SettingsWindow';
import { Modal } from '~/components/ui/Modal';
import { type TabType } from '~/components/settings/SettingsWindow';

interface WorkspaceProps {
  chatStarted?: boolean;
  isStreaming?: boolean;
}

interface SupabaseOrg {
  id: string;
  name: string;
  billing_email: string;
  created_at: string;
}

interface SupabaseProject {
  id: string;
  name: string;
  organization_id: string;
  region: string;
  status: string;
}

const viewTransition = { ease: cubicEasingFn };

const sliderOptions: SliderOptions<WorkbenchViewType> = {
  left: {
    value: 'code',
    text: 'Code',
  },
  right: {
    value: 'preview',
    text: 'Preview',
  },
};

const workbenchVariants = {
  closed: {
    width: 0,
    x: '-100%',
    transition: {
      duration: 0.2,
      ease: cubicEasingFn,
    },
  },
  open: {
    width: 'var(--workbench-width)',
    x: 0,
    transition: {
      duration: 0.2,
      ease: cubicEasingFn,
    },
  },
} satisfies Variants;

export const Workbench = memo(({ chatStarted, isStreaming }: WorkspaceProps) => {
  renderLogger.trace('Workbench');

  const [isSyncing, setIsSyncing] = useState(false);
  const [showSupabasePopover, setShowSupabasePopover] = useState(false);
  const [showProjectsPopover, setShowProjectsPopover] = useState(false);
  const [organizations, setOrganizations] = useState<SupabaseOrg[]>([]);
  const [selectedOrg, setSelectedOrg] = useState<SupabaseOrg | null>(null);
  const [isLoadingOrgs, setIsLoadingOrgs] = useState(false);
  const [showAccessTokenInput, setShowAccessTokenInput] = useState(false);
  const [showExtensionsPopover, setShowExtensionsPopover] = useState(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [settingsTab, setSettingsTab] = useState<TabType>('connection');
  const [showRepoNameModal, setShowRepoNameModal] = useState(false);
  const [repoNameError, setRepoNameError] = useState(false);
  const [showGitHubCredentialsModal, setShowGitHubCredentialsModal] = useState(false);
  const [githubCredentialsError, setGithubCredentialsError] = useState(false);

  const supabaseButtonRef = useRef<HTMLDivElement>(null);
  const orgButtonRef = useRef<HTMLDivElement>(null);
  const popoverRef = useRef<HTMLDivElement>(null);
  const projectsPopoverRef = useRef<HTMLDivElement>(null);
  const extensionsPopoverRef = useRef<HTMLDivElement>(null);

  // Function to initiate OAuth flow
  const initiateOAuthFlow = () => {
    try {
      const { env, isSupabaseConfigured } = window.ENV || {};

      if (!isSupabaseConfigured) {
        toast.error('Supabase is not properly configured. Please check your environment variables.');
        return;
      }

      const clientId = env?.SUPABASE_CLIENT_ID;

      if (!clientId) {
        toast.error('Supabase client configuration is missing');
        return;
      }

      const redirectUri = encodeURIComponent(window.location.origin + '/auth/callback');
      const scope = encodeURIComponent('all');
      const responseType = 'code';

      const authUrl =
        `https://api.supabase.com/v1/authorize?` +
        `response_type=${responseType}&` +
        `client_id=${clientId}&` +
        `redirect_uri=${redirectUri}&` +
        `scope=${scope}`;

      window.location.href = authUrl;
    } catch (error) {
      console.error('Error initiating OAuth flow:', error);
      toast.error('Failed to initiate Supabase authentication');
    }
  };

  // Function to exchange authorization code for access token
  const exchangeCodeForToken = async (code: string) => {
    try {
      const { env } = window.ENV || {};
      const clientId = env?.SUPABASE_CLIENT_ID;
      const clientSecret = env?.SUPABASE_CLIENT_SECRET;

      if (!clientId || !clientSecret) {
        throw new Error('Supabase client configuration is missing');
      }

      const response = await fetch('https://api.supabase.com/v1/token', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          grant_type: 'authorization_code',
          code,
          client_id: clientId,
          client_secret: clientSecret,
          redirect_uri: window.location.origin + '/auth/callback',
        }),
      });

      if (!response.ok) {
        const errorData = (await response.json().catch(() => ({}))) as { message?: string };
        throw new Error(errorData.message || 'Failed to exchange code for token');
      }

      const data = (await response.json()) as { access_token: string };
      Cookies.set('supabaseAccessToken', data.access_token, { expires: 30 });
      setShowAccessTokenInput(false);
      toast.success('Successfully authenticated with Supabase');
      await fetchOrganizations();
    } catch (error) {
      console.error('Error exchanging code for token:', error);
      toast.error(error instanceof Error ? error.message : 'Authentication failed. Please try again.');
      setShowAccessTokenInput(true);
    }
  };

  // Check for authorization code in URL on component mount
  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search);
    const code = urlParams.get('code');

    if (code) {
      exchangeCodeForToken(code);

      // Clean up URL
      window.history.replaceState({}, document.title, window.location.pathname);
    }
  }, []);

  // Function to fetch organizations from Supabase
  const fetchOrganizations = async () => {
    setIsLoadingOrgs(true);

    try {
      const supabaseAccessToken = Cookies.get('supabaseAccessToken');

      if (!supabaseAccessToken) {
        throw new Error('Supabase access token not found');
      }

      const orgsResponse = await fetch('https://api.supabase.com/v1/organizations', {
        method: 'GET',
        headers: {
          Authorization: `Bearer ${supabaseAccessToken}`,
        },
      });

      if (!orgsResponse.ok) {
        const errorData = (await orgsResponse.json().catch(() => ({}))) as { message?: string };
        throw new Error(errorData.message || 'Failed to fetch organizations');
      }

      const orgsData = (await orgsResponse.json()) as SupabaseOrg[];

      setOrganizations(orgsData);

      // If there's a previously selected org, restore it
      const savedOrgId = Cookies.get('supabaseOrgId');

      if (savedOrgId) {
        const savedOrg = orgsData.find((org) => org.id === savedOrgId);

        if (savedOrg) {
          setSelectedOrg(savedOrg);
        }
      }
    } catch (error) {
      console.error('Error fetching organizations:', error);
      toast.error(error instanceof Error ? error.message : 'Failed to fetch organizations');
      setShowAccessTokenInput(true);
    } finally {
      setIsLoadingOrgs(false);
    }
  };

  // Function to fetch projects for a selected organization
  const fetchProjects = async (orgId: string) => {
    try {
      const supabaseAccessToken = Cookies.get('supabaseAccessToken');

      if (!supabaseAccessToken) {
        throw new Error('Supabase access token not found');
      }

      const response = await fetch(`https://api.supabase.com/v1/projects?organization_id=${orgId}`, {
        method: 'GET',
        headers: {
          Authorization: `Bearer ${supabaseAccessToken}`,
          apikey: supabaseAccessToken,
        },
      });

      if (!response.ok) {
        throw new Error('Failed to fetch projects');
      }

      const allProjects = (await response.json()) as SupabaseProject[];

      // Separate active and inactive projects
      const activeProjects = allProjects.filter((p) => p.status === 'active_healthy');
      const inactiveProjects = allProjects.filter((p) => p.status !== 'active_healthy');

      // Store projects in cookies
      Cookies.set('supabaseActiveProjects', JSON.stringify(activeProjects));
      Cookies.set('supabaseInactiveProjects', JSON.stringify(inactiveProjects));

      return { activeProjects, inactiveProjects };
    } catch (error) {
      console.error('Error fetching projects:', error);
      toast.error('Failed to fetch projects. Please try again.');

      return { activeProjects: [], inactiveProjects: [] };
    }
  };

  // Handle organization selection
  const handleSelectOrg = async (org: SupabaseOrg) => {
    setSelectedOrg(org);
    Cookies.set('supabaseOrgId', org.id);
    Cookies.set('supabaseOrgName', org.name);
    await fetchProjects(org.id);
  };

  useEffect(() => {
    const supabaseAccessToken = Cookies.get('supabaseAccessToken');

    if (supabaseAccessToken && showSupabasePopover) {
      fetchOrganizations();
    }
  }, [showSupabasePopover]);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        !popoverRef.current?.contains(event.target as Node) &&
        !supabaseButtonRef.current?.contains(event.target as Node) &&
        !projectsPopoverRef.current?.contains(event.target as Node) &&
        !orgButtonRef.current?.contains(event.target as Node)
      ) {
        setShowSupabasePopover(false);
        setShowProjectsPopover(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);

    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const hasPreview = useStore(computed(workbenchStore.previews, (previews) => previews.length > 0));
  const showWorkbench = useStore(workbenchStore.showWorkbench);
  const selectedFile = useStore(workbenchStore.selectedFile);
  const currentDocument = useStore(workbenchStore.currentDocument);
  const unsavedFiles = useStore(workbenchStore.unsavedFiles);
  const files = useStore(workbenchStore.files);
  const selectedView = useStore(workbenchStore.currentView);

  const isSmallViewport = useViewport(1024);

  const setSelectedView = (view: WorkbenchViewType) => {
    workbenchStore.currentView.set(view);
  };

  useEffect(() => {
    if (hasPreview) {
      setSelectedView('preview');
    }
  }, [hasPreview]);

  useEffect(() => {
    workbenchStore.setDocuments(files);
  }, [files]);

  const onEditorChange = useCallback<OnEditorChange>((update) => {
    workbenchStore.setCurrentDocumentContent(update.content);
  }, []);

  const onEditorScroll = useCallback<OnEditorScroll>((position) => {
    workbenchStore.setCurrentDocumentScrollPosition(position);
  }, []);

  const onFileSelect = useCallback((filePath: string | undefined) => {
    workbenchStore.setSelectedFile(filePath);
  }, []);

  const onFileSave = useCallback(() => {
    workbenchStore.saveCurrentDocument().catch(() => {
      toast.error('Failed to update file content');
    });
  }, []);

  const onFileReset = useCallback(() => {
    workbenchStore.resetCurrentDocument();
  }, []);

  const handleSyncFiles = useCallback(async () => {
    setIsSyncing(true);

    try {
      const directoryHandle = await window.showDirectoryPicker();
      await workbenchStore.syncFiles(directoryHandle);
      toast.success('Files synced successfully');
    } catch (error) {
      console.error('Error syncing files:', error);
      toast.error('Failed to sync files');
    } finally {
      setIsSyncing(false);
    }
  }, []);

  return (
    chatStarted && (
      <motion.div
        initial="closed"
        animate={showWorkbench ? 'open' : 'closed'}
        variants={workbenchVariants}
        className="z-workbench"
      >
        <div
          className={classNames(
            'fixed top-[calc(var(--header-height)+1.5rem)] bottom-6 w-[var(--workbench-inner-width)] mr-4 z-0 transition-[left,width,transform] duration-200 bolt-ease-cubic-bezier',
            {
              'w-full': isSmallViewport,
              'left-0': showWorkbench && isSmallViewport,
              'left-[var(--workbench-left)]': showWorkbench,
              'left-[-100%]': !showWorkbench,
            },
          )}
        >
          <div className="absolute inset-0 px-2 lg:px-6">
            <div className="h-full flex flex-col bg-bolt-elements-background-depth-2 border border-bolt-elements-borderColor shadow-sm rounded-lg overflow-hidden">
              <div className="flex items-center px-3 py-2 border-b border-bolt-elements-borderColor">
                <Slider selected={selectedView} options={sliderOptions} setSelected={setSelectedView} />
                <div className="ml-auto" />
                {selectedView === 'code' && (
                  <div className="flex overflow-y-auto">
                    <PanelHeaderButton
                      className="mr-1 text-sm bg-gradient-to-r from-cyan-500/20 via-violet-500/20 to-fuchsia-500/20 hover:from-cyan-500/30 hover:via-violet-500/30 hover:to-fuchsia-500/30 border border-white/10 transition-colors"
                      onClick={() => {
                        workbenchStore.downloadZip();
                      }}
                    >
                      <div className="i-ph:code text-cyan-400 group-hover:text-cyan-300" />
                      <span className="bg-gradient-to-r from-cyan-400 via-violet-400 to-fuchsia-400 bg-clip-text text-transparent">
                        Download Code
                      </span>
                    </PanelHeaderButton>
                    <div className="relative">
                      <PanelHeaderButton
                        className="mr-1 text-sm bg-gradient-to-r from-cyan-500/20 via-violet-500/20 to-fuchsia-500/20 hover:from-cyan-500/30 hover:via-violet-500/30 hover:to-fuchsia-500/30 border border-white/10 transition-colors"
                        onClick={() => setShowExtensionsPopover(true)}
                      >
                        <div className="i-ph:puzzle-piece text-cyan-400 group-hover:text-cyan-300" />
                        <span className="bg-gradient-to-r from-cyan-400 via-violet-400 to-fuchsia-400 bg-clip-text text-transparent">
                          Extensions
                        </span>
                        <div className="i-ph:caret-down ml-1 text-cyan-400 group-hover:text-cyan-300" />
                      </PanelHeaderButton>

                      {showExtensionsPopover && (
                        <motion.div
                          ref={extensionsPopoverRef}
                          initial={{ opacity: 0, scale: 0.95 }}
                          animate={{ opacity: 1, scale: 1 }}
                          exit={{ opacity: 0, scale: 0.95 }}
                          className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/50 backdrop-blur-sm"
                          onClick={(e) => {
                            if (e.target === e.currentTarget) {
                              setShowExtensionsPopover(false);
                            }
                          }}
                        >
                          <motion.div
                            className="w-96 rounded-2xl bg-gradient-to-br from-black/90 via-black/95 to-black/98 border border-white/10 shadow-2xl"
                            onClick={(e) => e.stopPropagation()}
                          >
                            <div className="flex items-center justify-between p-4 border-b border-white/10">
                              <div className="flex items-center gap-3">
                                <div className="p-2 rounded-lg bg-gradient-to-br from-cyan-500/20 via-violet-500/20 to-fuchsia-500/20 backdrop-blur-sm border border-white/5">
                                  <div className="i-ph:puzzle-piece text-2xl text-white" />
                                </div>
                                <div className="flex flex-col">
                                  <div className="flex items-center gap-2">
                                    <h2 className="text-xl font-bold bg-gradient-to-r from-cyan-400 via-violet-400 to-fuchsia-400 bg-clip-text text-transparent">
                                      Extensions
                                    </h2>
                                    <span className="px-1.5 py-0.5 text-[10px] bg-white rounded-full">Beta</span>
                                  </div>
                                  <div className="flex items-center gap-2 mt-1">
                                    <div className="i-ph:cube text-cyan-400 group-hover:text-cyan-300" />
                                    <p
                                      className="text-xs text-white/50 hover:text-white/70 transition-colors cursor-pointer"
                                      onClick={() => {
                                        setShowExtensionsPopover(false);
                                        setSettingsTab('connection');
                                        setIsSettingsOpen(true);
                                      }}
                                    >
                                      Add functionality to your workspace
                                    </p>
                                  </div>
                                </div>
                              </div>
                              <button
                                className="p-1 rounded-lg hover:bg-white/5 transition-colors"
                                onClick={() => setShowExtensionsPopover(false)}
                              >
                                <div className="i-ph:x text-lg text-white/70 hover:text-white/90" />
                              </button>
                            </div>

                            <div className="p-4 space-y-2">
                              <PanelHeaderButton
                                className="w-full text-sm bg-gradient-to-r from-cyan-500/20 via-violet-500/20 to-fuchsia-500/20 hover:from-cyan-500/30 hover:via-violet-500/30 hover:to-fuchsia-500/30 border border-white/10 transition-colors"
                                onClick={() => {
                                  setShowExtensionsPopover(false);
                                  setShowRepoNameModal(true);
                                }}
                              >
                                <div className="i-ph:github-logo" />
                                <span className="bg-gradient-to-r from-cyan-400 via-violet-400 to-fuchsia-400 bg-clip-text text-transparent">
                                  Push to GitHub
                                </span>
                              </PanelHeaderButton>
                            </div>
                          </motion.div>
                        </motion.div>
                      )}
                    </div>
                    <PanelHeaderButton
                      className="mr-1 text-sm bg-gradient-to-r from-cyan-500/20 via-violet-500/20 to-fuchsia-500/20 hover:from-cyan-500/30 hover:via-violet-500/30 hover:to-fuchsia-500/30 border border-white/10 transition-colors"
                      onClick={handleSyncFiles}
                      disabled={isSyncing}
                    >
                      {isSyncing ? (
                        <div className="i-ph:spinner text-cyan-400" />
                      ) : (
                        <div className="i-ph:cloud-arrow-down text-cyan-400 group-hover:text-cyan-300" />
                      )}
                      <span className="bg-gradient-to-r from-cyan-400 via-violet-400 to-fuchsia-400 bg-clip-text text-transparent">
                        {isSyncing ? 'Syncing...' : 'Sync Files'}
                      </span>
                    </PanelHeaderButton>
                    <PanelHeaderButton
                      className="mr-1 text-sm bg-gradient-to-r from-cyan-500/20 via-violet-500/20 to-fuchsia-500/20 hover:from-cyan-500/30 hover:via-violet-500/30 hover:to-fuchsia-500/30 border border-white/10 transition-colors"
                      onClick={() => {
                        workbenchStore.toggleTerminal(!workbenchStore.showTerminal.get());
                      }}
                    >
                      <div className="i-ph:terminal text-cyan-400 group-hover:text-cyan-300" />
                      <span className="bg-gradient-to-r from-cyan-400 via-violet-400 to-fuchsia-400 bg-clip-text text-transparent">
                        Toggle Terminal
                      </span>
                    </PanelHeaderButton>
                  </div>
                )}
                <IconButton
                  icon="i-ph:x-circle"
                  className="-mr-1"
                  size="xl"
                  onClick={() => {
                    workbenchStore.showWorkbench.set(false);
                  }}
                />
              </div>
              <div className="relative flex-1 overflow-hidden">
                <View
                  initial={{ x: selectedView === 'code' ? 0 : '-100%' }}
                  animate={{ x: selectedView === 'code' ? 0 : '-100%' }}
                >
                  <EditorPanel
                    editorDocument={currentDocument}
                    isStreaming={isStreaming}
                    selectedFile={selectedFile}
                    files={files}
                    unsavedFiles={unsavedFiles}
                    onFileSelect={onFileSelect}
                    onEditorScroll={onEditorScroll}
                    onEditorChange={onEditorChange}
                    onFileSave={onFileSave}
                    onFileReset={onFileReset}
                  />
                </View>
                <View
                  initial={{ x: selectedView === 'preview' ? 0 : '100%' }}
                  animate={{ x: selectedView === 'preview' ? 0 : '100%' }}
                >
                  <Preview />
                </View>
              </div>
            </div>
          </div>
        </div>
        {showSupabasePopover && (
          <motion.div
            ref={popoverRef}
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.95 }}
            className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/50 backdrop-blur-sm"
            onClick={(e) => {
              if (e.target === e.currentTarget) {
                setShowSupabasePopover(false);
              }
            }}
          >
            <motion.div
              className="w-[32rem] rounded-2xl bg-gradient-to-br from-black/90 via-black/95 to-black/98 border border-white/10 shadow-2xl"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-center justify-between p-4 border-b border-white/10">
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-lg bg-gradient-to-br from-cyan-500/20 via-violet-500/20 to-fuchsia-500/20 backdrop-blur-sm border border-white/5">
                    <SiSupabase className="text-2xl text-white" />
                  </div>
                  <div>
                    <h2 className="text-xl font-bold bg-gradient-to-r from-cyan-400 via-violet-400 to-fuchsia-400 bg-clip-text text-transparent">
                      Supabase
                    </h2>
                    <p className="text-xs text-white/50">Database & Authentication</p>
                  </div>
                </div>
                <button
                  className="p-1 rounded-lg hover:bg-white/5 transition-colors"
                  onClick={() => setShowSupabasePopover(false)}
                >
                  <div className="i-ph:x text-lg text-white/70 hover:text-white/90" />
                </button>
              </div>

              <div className="p-6 space-y-4">
                {!Cookies.get('supabaseAccessToken') || showAccessTokenInput ? (
                  <div className="space-y-4">
                    <div className="p-4 rounded-xl bg-gradient-to-r from-white/5 to-transparent border border-white/10">
                      <h3 className="text-sm font-medium text-white/90 mb-2">Authentication Required</h3>
                      <p className="text-xs text-white/70 mb-4">
                        Connect your Supabase account to access organizations and projects.
                      </p>
                      <motion.button
                        whileHover={{ scale: 1.02 }}
                        onClick={initiateOAuthFlow}
                        className="w-full py-2 px-4 text-center text-white transition-colors rounded-lg bg-gradient-to-r from-cyan-500 to-violet-500 hover:from-cyan-400 hover:to-violet-400 flex items-center justify-center gap-2"
                      >
                        <div className="i-ph:sign-in" />
                        Sign in with Supabase
                      </motion.button>
                    </div>
                  </div>
                ) : (
                  <>
                    <p className="text-sm text-white/70 mb-6 leading-relaxed">
                      Connect to add authentication, store data, or call third party APIs.{' '}
                      <a
                        href="https://supabase.com/docs"
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-cyan-400 hover:text-cyan-300 transition-colors underline decoration-white/20 hover:decoration-cyan-300/50"
                      >
                        View Documentation
                      </a>
                    </p>

                    <div className="flex justify-between items-center mb-4">
                      <h3 className="text-lg font-semibold text-white/90 flex items-center gap-2">
                        <div className="i-ph:buildings-duotone text-cyan-400" />
                        Select Organization
                      </h3>
                      <motion.button
                        whileHover={{ scale: 1.02 }}
                        onClick={() => setShowAccessTokenInput(true)}
                        className="text-xs text-white/50 hover:text-white/70 transition-colors flex items-center gap-1"
                      >
                        <div className="i-ph:key" />
                        Change Token
                      </motion.button>
                    </div>

                    <div className="space-y-2">
                      {isLoadingOrgs ? (
                        <div className="flex items-center justify-center py-8">
                          <div className="animate-spin text-2xl text-cyan-400">
                            <div className="i-ph:circle-notch" />
                          </div>
                        </div>
                      ) : organizations.length > 0 ? (
                        organizations.map((org) => (
                          <motion.div
                            key={org.id}
                            whileHover={{ scale: 1.02 }}
                            className={classNames(
                              'flex items-center gap-3 p-4 rounded-xl bg-gradient-to-r from-white/5 to-transparent hover:from-white/10 hover:to-white/5 border border-white/10 cursor-pointer group transition-all duration-300',
                              selectedOrg?.id === org.id ? 'border-cyan-500/50' : 'border-white/10',
                            )}
                            onClick={() => handleSelectOrg(org)}
                          >
                            <div className="flex-1 min-w-0">
                              <span className="text-lg text-white group-hover:text-cyan-300 transition-colors truncate block">
                                {org.name}
                              </span>
                              <span className="text-xs text-white/50 group-hover:text-white/70 transition-colors">
                                {org.billing_email}
                              </span>
                            </div>
                            {selectedOrg?.id === org.id && (
                              <div className="shrink-0 w-8 h-8 rounded-lg bg-gradient-to-br from-cyan-500/20 via-violet-500/20 to-fuchsia-500/20 flex items-center justify-center border border-cyan-500/50">
                                <div className="i-ph:check text-cyan-400" />
                              </div>
                            )}
                          </motion.div>
                        ))
                      ) : (
                        <div className="text-center py-8">
                          <div className="text-white/50 mb-2">No organizations found</div>
                          <p className="text-sm text-white/30">Create a new organization to get started</p>
                        </div>
                      )}

                      <motion.button
                        whileHover={{ scale: 1.02 }}
                        onClick={() =>
                          window.open(
                            'https://supabase.com/dashboard/new/organization',
                            '_blank',
                            'noopener,noreferrer',
                          )
                        }
                        className="w-full py-3 px-4 text-center text-white/70 hover:text-white transition-colors rounded-xl bg-gradient-to-r from-white/5 to-transparent hover:from-white/10 hover:to-white/5 border border-white/10 flex items-center justify-center gap-2 group"
                      >
                        <div className="i-ph:plus-circle text-lg group-hover:text-cyan-300 transition-colors" />
                        Create New Organization
                      </motion.button>
                    </div>
                  </>
                )}
              </div>
            </motion.div>
          </motion.div>
        )}

        {showProjectsPopover && (
          <motion.div
            ref={projectsPopoverRef}
            initial={{ opacity: 0, x: -10 }}
            animate={{ opacity: 1, x: 0 }}
            className="fixed w-[90vw] sm:w-96 rounded-2xl bg-gradient-to-br from-black/80 via-black/90 to-black/95 border border-white/10 shadow-2xl z-[101] backdrop-blur-2xl"
            style={{
              top: orgButtonRef.current?.getBoundingClientRect().top || 0,
              left: (popoverRef.current?.getBoundingClientRect().right || 0) + 8,
            }}
            onMouseEnter={() => setShowProjectsPopover(true)}
            onMouseLeave={() => setShowProjectsPopover(false)}
          >
            <div className="p-6 relative overflow-hidden">
              {/* Animated background gradients */}
              <div className="absolute inset-0">
                <div className="absolute -top-32 -right-32 w-64 h-64 rounded-full bg-cyan-500/20 blur-3xl animate-pulse" />
                <div className="absolute -bottom-32 -left-32 w-64 h-64 rounded-full bg-violet-500/20 blur-3xl animate-pulse delay-300" />
                <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-64 h-64 rounded-full bg-fuchsia-500/20 blur-3xl animate-pulse delay-700" />
              </div>
              <div className="relative">
                <div className="flex items-center gap-3 mb-6">
                  <div className="p-2 rounded-lg bg-gradient-to-br from-cyan-500/20 via-violet-500/20 to-fuchsia-500/20 backdrop-blur-sm border border-white/5">
                    <div className="i-ph:database text-2xl text-white" />
                  </div>
                  <div>
                    <h2 className="text-xl font-bold bg-gradient-to-r from-cyan-400 via-violet-400 to-fuchsia-400 bg-clip-text text-transparent">
                      Projects
                    </h2>
                    <p className="text-xs text-white/50">Select a project to connect</p>
                  </div>
                </div>

                <div className="space-y-6">
                  {isLoadingOrgs ? (
                    <div className="flex items-center justify-center py-8">
                      <div className="animate-spin text-2xl text-cyan-400">
                        <div className="i-ph:circle-notch" />
                      </div>
                    </div>
                  ) : organizations.length > 0 ? (
                    organizations.map((org) => (
                      <motion.div
                        key={org.id}
                        whileHover={{ scale: 1.02 }}
                        className={classNames(
                          'flex items-center gap-3 p-4 rounded-xl bg-gradient-to-r from-white/5 to-transparent hover:from-white/10 hover:to-white/5 border border-white/10 cursor-pointer group transition-all duration-300',
                          selectedOrg?.id === org.id ? 'border-cyan-500/50' : 'border-white/10',
                        )}
                        onClick={() => handleSelectOrg(org)}
                      >
                        <div className="flex-1 min-w-0">
                          <span className="text-lg text-white group-hover:text-cyan-300 transition-colors truncate block">
                            {org.name}
                          </span>
                          <span className="text-xs text-white/50 group-hover:text-white/70 transition-colors">
                            {org.billing_email}
                          </span>
                        </div>
                        {selectedOrg?.id === org.id && (
                          <div className="shrink-0 w-8 h-8 rounded-lg bg-gradient-to-br from-cyan-500/20 via-violet-500/20 to-fuchsia-500/20 flex items-center justify-center border border-cyan-500/50">
                            <div className="i-ph:check text-cyan-400" />
                          </div>
                        )}
                      </motion.div>
                    ))
                  ) : (
                    <div className="text-center py-8">
                      <div className="text-white/50 mb-2">No organizations found</div>
                      <p className="text-sm text-white/30">Create a new organization to get started</p>
                    </div>
                  )}

                  <motion.button
                    whileHover={{ scale: 1.02 }}
                    onClick={() =>
                      window.open('https://supabase.com/dashboard/new/organization', '_blank', 'noopener,noreferrer')
                    }
                    className="w-full py-3 px-4 text-center text-white/70 hover:text-white transition-colors rounded-xl bg-gradient-to-r from-white/5 to-transparent hover:from-white/10 hover:to-white/5 border border-white/10 flex items-center justify-center gap-2 group"
                  >
                    <div className="i-ph:plus-circle text-lg group-hover:text-cyan-300 transition-colors" />
                    Create New Organization
                  </motion.button>
                </div>
              </div>
            </div>
          </motion.div>
        )}

        <Modal
          isOpen={showRepoNameModal}
          onClose={() => {
            setShowRepoNameModal(false);
            setRepoNameError(false);
          }}
          title="Push to GitHub"
          message={
            repoNameError
              ? 'Repository name is required to push your code to GitHub.'
              : 'Please enter a name for your new GitHub repository:'
          }
          confirmLabel="Continue"
          cancelLabel="Cancel"
          onConfirm={() => {
            const repoName = (document.getElementById('repo-name-input') as HTMLInputElement)?.value;

            if (!repoName) {
              setRepoNameError(true);
              return;
            }

            const githubUsername = Cookies.get('githubUsername');
            const githubToken = Cookies.get('githubToken');

            if (!githubUsername || !githubToken) {
              setShowGitHubCredentialsModal(true);
              return;
            }

            workbenchStore.pushToGitHub(repoName, githubUsername, githubToken);
            setShowRepoNameModal(false);
            setRepoNameError(false);
          }}
        >
          <div className="mt-4">
            <input
              id="repo-name-input"
              type="text"
              placeholder="repository-name"
              defaultValue="Val-X-generated-project"
              className={classNames(
                'w-full px-4 py-2 text-sm text-white bg-white/5 rounded-lg border focus:outline-none focus:ring-2 transition-colors',
                repoNameError
                  ? 'border-red-500/50 focus:border-red-500 focus:ring-red-500/20'
                  : 'border-white/10 focus:border-cyan-500 focus:ring-cyan-500/20',
              )}
            />
            {repoNameError && <p className="mt-2 text-xs text-red-400">Please enter a repository name</p>}
          </div>
        </Modal>

        <Modal
          isOpen={showGitHubCredentialsModal}
          onClose={() => {
            setShowGitHubCredentialsModal(false);
            setGithubCredentialsError(false);
          }}
          title="GitHub Credentials"
          message="Please enter your GitHub credentials to push your code:"
          confirmLabel="Push to GitHub"
          cancelLabel="Cancel"
          onConfirm={() => {
            const username = (document.getElementById('github-username-input') as HTMLInputElement)?.value;
            const token = (document.getElementById('github-token-input') as HTMLInputElement)?.value;
            const repoName = (document.getElementById('repo-name-input') as HTMLInputElement)?.value;

            if (!username || !token) {
              setGithubCredentialsError(true);
              return;
            }

            workbenchStore.pushToGitHub(repoName!, username, token);
            setShowGitHubCredentialsModal(false);
            setShowRepoNameModal(false);
            setGithubCredentialsError(false);
          }}
        >
          <div className="space-y-4">
            <div>
              <input
                id="github-username-input"
                type="text"
                placeholder="GitHub Username"
                className={classNames(
                  'w-full px-4 py-2 text-sm text-white bg-white/5 rounded-lg border focus:outline-none focus:ring-2 transition-colors',
                  githubCredentialsError
                    ? 'border-red-500/50 focus:border-red-500 focus:ring-red-500/20'
                    : 'border-white/10 focus:border-cyan-500 focus:ring-cyan-500/20',
                )}
              />
            </div>
            <div>
              <input
                id="github-token-input"
                type="password"
                placeholder="Personal Access Token"
                className={classNames(
                  'w-full px-4 py-2 text-sm text-white bg-white/5 rounded-lg border focus:outline-none focus:ring-2 transition-colors',
                  githubCredentialsError
                    ? 'border-red-500/50 focus:border-red-500 focus:ring-red-500/20'
                    : 'border-white/10 focus:border-cyan-500 focus:ring-cyan-500/20',
                )}
              />
            </div>
            {githubCredentialsError && (
              <p className="text-xs text-red-400">Please enter both GitHub username and personal access token</p>
            )}
            <p className="text-xs text-white/50">
              Need a token?{' '}
              <a
                href="https://github.com/settings/tokens/new"
                target="_blank"
                rel="noopener noreferrer"
                className="text-cyan-400 hover:text-cyan-300 transition-colors"
              >
                Create one here
              </a>
            </p>
          </div>
        </Modal>

        <SettingsWindow open={isSettingsOpen} onClose={() => setIsSettingsOpen(false)} initialTab={settingsTab} />
      </motion.div>
    )
  );
});

interface ViewProps extends HTMLMotionProps<'div'> {
  children: JSX.Element;
}

const View = memo(({ children, ...props }: ViewProps) => {
  return (
    <motion.div className="absolute inset-0" transition={viewTransition} {...props}>
      {children}
    </motion.div>
  );
});
