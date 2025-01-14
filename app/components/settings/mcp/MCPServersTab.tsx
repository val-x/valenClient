import { useStore } from '@nanostores/react';
import { useEffect, useState } from 'react';
import { toast } from 'react-toastify';
import { logStore } from '~/lib/stores/logs';
import {
  type MCPServerConfig,
  mcpServersStore,
  initMCPServers,
  connectMCPServer,
  disconnectMCPServer,
} from '~/lib/stores/mcp';
import { SiSupabase } from 'react-icons/si';
import Cookies from 'js-cookie';
import { Dialog } from '~/components/ui/Dialog';
import { Input } from '~/components/ui/Input';
import { createPortal } from 'react-dom';

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
  created_at: string;
}

interface NewProjectFormData {
  name: string;
  region: string;
  dbPass: string;
}

interface NewOrgFormData {
  name: string;
  billing_email: string;
}

interface ProjectStatus {
  color: string;
  label: string;
  icon: string;
}

interface SupabaseAuthError {
  message: string;
}

// Add this type for message event data
interface SupabaseAuthMessageData {
  type: string;
  accessToken?: string;
  orgId?: string;
}

// Add this type for MCP server connection
interface MCPServerConnection {
  type: string;
  config: Record<string, string>;
}

const PROJECT_STATUS: Record<string, ProjectStatus> = {
  active_healthy: {
    color: 'text-green-500',
    label: 'Active',
    icon: 'i-ph:check-circle',
  },
  active_unhealthy: {
    color: 'text-yellow-500',
    label: 'Unhealthy',
    icon: 'i-ph:warning',
  },
  paused: {
    color: 'text-gray-500',
    label: 'Paused',
    icon: 'i-ph:pause',
  },
  inactive: {
    color: 'text-red-500',
    label: 'Inactive',
    icon: 'i-ph:x-circle',
  },
  initializing: {
    color: 'text-blue-500',
    label: 'Initializing',
    icon: 'i-ph:spinner animate-spin',
  },
  default: {
    color: 'text-gray-500',
    label: 'Unknown',
    icon: 'i-ph:question',
  },
};

const REGIONS = [
  { id: 'us-east-1', name: 'US East (N. Virginia)' },
  { id: 'us-west-1', name: 'US West (N. California)' },
  { id: 'eu-central-1', name: 'EU (Frankfurt)' },
  { id: 'ap-southeast-1', name: 'Asia Pacific (Singapore)' },
] as const;

const SERVER_TYPE_ICONS = {
  supabase: <SiSupabase className="text-2xl text-white" />,
  default: <div className="i-ph:cube text-2xl text-white" />,
};

const SERVER_TYPE_DESCRIPTIONS = {
  supabase: 'Connect to Supabase to enable database operations, storage management, and edge functions.',
  default: 'Connect to add functionality to your workspace.',
};

// Add this type for modal management
type ModalType = 'newOrg' | 'newProject' | null;

const validateToken = (token: string | undefined): boolean => {
  return Boolean(token && token.length > 0 && token !== 'null' && token !== 'undefined');
};

const getAuthToken = (): string | null => {
  const token = Cookies.get('supabaseAccessToken');
  return token && validateToken(token) ? token : null;
};

const POPUP_WIDTH = 600;
const POPUP_HEIGHT = 700;

const openAuthPopup = (url: string): Window | null => {
  const left = window.screenX + (window.outerWidth - POPUP_WIDTH) / 2;
  const top = window.screenY + (window.outerHeight - POPUP_HEIGHT) / 2;

  return window.open(
    url,
    'Supabase Auth',
    `width=${POPUP_WIDTH},height=${POPUP_HEIGHT},left=${left},top=${top},toolbar=0,location=0,status=0,menubar=0,scrollbars=1,resizable=1`,
  );
};

const getStoredToken = (): string | null => {
  const token = Cookies.get('supabaseAccessToken');
  return token && token !== 'undefined' && token !== 'null' ? token : null;
};

export default function McpServersTab() {
  const mcpServers = useStore(mcpServersStore);
  const [isConnecting, setIsConnecting] = useState<Record<string, boolean>>({});
  const [isAuthenticating, setIsAuthenticating] = useState(false);
  const [organizations, setOrganizations] = useState<SupabaseOrg[]>([]);
  const [projects, setProjects] = useState<SupabaseProject[]>([]);
  const [selectedOrg, setSelectedOrg] = useState<string | null>(null);
  const [activeModal, setActiveModal] = useState<ModalType>(null);
  const [newProjectData, setNewProjectData] = useState<NewProjectFormData>({
    name: '',
    region: REGIONS[0].id,
    dbPass: '',
  });
  const [isCreatingProject, setIsCreatingProject] = useState(false);
  const [isCreatingOrg, setIsCreatingOrg] = useState(false);
  const [newOrgData, setNewOrgData] = useState<NewOrgFormData>({
    name: '',
    billing_email: '',
  });
  const [isSupabaseAuthenticated, setIsSupabaseAuthenticated] = useState(false);

  useEffect(() => {
    initMCPServers();

    const isAuthenticated = checkSupabaseAuth();

    if (isAuthenticated) {
      fetchOrganizations();
    }
  }, []);

  useEffect(() => {
    if (selectedOrg) {
      fetchProjects(selectedOrg);
    }
  }, [selectedOrg]);

  const checkSupabaseAuth = () => {
    const accessToken = getStoredToken();
    const isAuthenticated = Boolean(accessToken);
    setIsSupabaseAuthenticated(isAuthenticated);

    return isAuthenticated;
  };

  const fetchOrganizations = async () => {
    const accessToken = getStoredToken();

    if (!accessToken) {
      setIsSupabaseAuthenticated(false);
      return;
    }

    try {
      const response = await fetch('https://api.supabase.com/v1/organizations', {
        headers: {
          Authorization: `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
      });

      if (response.status === 401) {
        Cookies.remove('supabaseAccessToken');
        setIsSupabaseAuthenticated(false);
        initiateSupabaseAuth();

        return;
      }

      if (!response.ok) {
        throw new Error('Failed to fetch organizations');
      }

      const orgs = (await response.json()) as SupabaseOrg[];
      setOrganizations(orgs);
    } catch (error) {
      console.error('Error fetching organizations:', error);

      if (error instanceof Error && error.message.includes('401')) {
        toast.error('Session expired. Please reconnect to Supabase.');
        setIsSupabaseAuthenticated(false);
      } else {
        toast.error('Failed to fetch Supabase organizations');
      }
    }
  };

  const fetchProjects = async (orgId: string) => {
    const accessToken = getAuthToken();

    if (!accessToken) {
      setIsSupabaseAuthenticated(false);
      return;
    }

    try {
      const response = await fetch(`https://api.supabase.com/v1/projects?organization_id=${orgId}`, {
        headers: {
          Authorization: `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
      });

      if (response.status === 401) {
        toast.error('Session expired. Please reconnect to Supabase.');
        setIsSupabaseAuthenticated(false);

        return;
      }

      if (!response.ok) {
        throw new Error('Failed to fetch projects');
      }

      const projectList = (await response.json()) as SupabaseProject[];
      setProjects(projectList);
    } catch (error) {
      console.error('Error fetching projects:', error);

      if (error instanceof Error && error.message.includes('401')) {
        toast.error('Session expired. Please reconnect to Supabase.');
        setIsSupabaseAuthenticated(false);
      } else {
        toast.error('Failed to fetch Supabase projects');
      }
    }
  };

  const createProject = async (orgId: string, projectData: NewProjectFormData) => {
    const accessToken = getAuthToken();

    if (!accessToken) {
      setIsSupabaseAuthenticated(false);
      initiateSupabaseAuth();

      return;
    }

    setIsCreatingProject(true);

    try {
      const response = await fetch('https://api.supabase.com/v1/projects', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          name: projectData.name,
          organization_id: orgId,
          region: projectData.region,
          plan: 'free',
          db_pass: projectData.dbPass,
        }),
      });

      if (!response.ok) {
        const errorData = (await response.json()) as SupabaseAuthError;
        throw new Error(errorData.message || 'Failed to create project');
      }

      const project = (await response.json()) as SupabaseProject;
      setProjects((prev) => [...prev, project]);
      toast.success('Project created successfully');
      closeModal();
    } catch (error) {
      console.error('Error creating project:', error);
      toast.error(error instanceof Error ? error.message : 'Failed to create project');
    } finally {
      setIsCreatingProject(false);
    }
  };

  const initiateSupabaseAuth = async () => {
    try {
      const { env, isSupabaseConfigured } = (window as Window).ENV || {};

      if (!env) {
        toast.error('Environment configuration is missing');
        return;
      }

      if (!isSupabaseConfigured) {
        toast.error(
          <div className="flex flex-col gap-2">
            <p>Supabase is not properly configured. Please check:</p>
            <ul className="list-disc ml-4 text-sm">
              <li>SUPABASE_CLIENT_ID is set</li>
              <li>SUPABASE_CLIENT_SECRET is set</li>
              <li>Environment variables are loaded correctly</li>
            </ul>
          </div>,
          { autoClose: 8000 },
        );
        return;
      }

      const clientId = env.SUPABASE_CLIENT_ID;

      if (!clientId) {
        toast.error('Supabase Client ID is missing in environment configuration');
        return;
      }

      setIsAuthenticating(true);

      const redirectUri = encodeURIComponent(window.location.origin + '/auth/callback');
      const scope = encodeURIComponent('all');
      const responseType = 'code';
      const state = Math.random().toString(36).substring(7);

      // Store state for verification
      sessionStorage.setItem('supabaseAuthState', state);

      const authUrl =
        `https://api.supabase.com/v1/authorize?` +
        `response_type=${responseType}&` +
        `client_id=${clientId}&` +
        `redirect_uri=${redirectUri}&` +
        `scope=${scope}&` +
        `state=${state}`;

      const popup = openAuthPopup(authUrl);

      if (!popup) {
        toast.error('Popup was blocked. Please allow popups for this site.');
        setIsAuthenticating(false);

        return;
      }

      // Add message listener for popup communication
      const messageHandler = (event: MessageEvent) => {
        if (event.origin !== window.location.origin) {
          return;
        }

        const data = event.data as SupabaseAuthMessageData;

        if (data?.type === 'supabaseAuthSuccess') {
          const { accessToken, orgId } = data;

          if (accessToken) {
            Cookies.set('supabaseAccessToken', accessToken);

            if (orgId) {
              Cookies.set('supabaseOrgId', orgId);
            }

            setIsSupabaseAuthenticated(true);
            fetchOrganizations();
            toast.success('Successfully connected to Supabase');
          }

          window.removeEventListener('message', messageHandler);
          setIsAuthenticating(false);
          popup.close();
        }

        if (data?.type === 'supabaseAuthError') {
          toast.error('Authentication failed. Please try again.');
          window.removeEventListener('message', messageHandler);
          setIsAuthenticating(false);
          popup.close();
        }
      };

      window.addEventListener('message', messageHandler);

      // Check if popup was closed
      const checkClosed = setInterval(() => {
        if (popup.closed) {
          clearInterval(checkClosed);
          window.removeEventListener('message', messageHandler);
          setIsAuthenticating(false);
        }
      }, 1000);
    } catch (error) {
      console.error('Error initiating OAuth flow:', error);
      toast.error('Failed to initiate Supabase authentication');
      setIsAuthenticating(false);
    }
  };

  const handleConnect = async (server: MCPServerConfig) => {
    if (server.type === 'supabase') {
      const accessToken = getStoredToken();

      if (!accessToken) {
        initiateSupabaseAuth();
        return;
      }

      // Get the selected project's details
      const selectedProject = projects.find((p) => p.organization_id === selectedOrg);

      if (!selectedProject) {
        toast.error('Please select a project first');
        return;
      }

      setIsConnecting((prev) => ({ ...prev, [server.id]: true }));

      try {
        // Create MCP server connection config
        const connectionConfig: MCPServerConnection = {
          type: 'supabase',
          config: {
            projectUrl: `https://${selectedProject.id}.supabase.co`,
            accessToken,
          },
        };

        // Connect to MCP server with config
        await connectMCPServer(server.id, connectionConfig.config);

        logStore.logSystem('MCP server connected', {
          server: server.name,
          type: server.type,
          project: selectedProject.name,
        });

        toast.success(`Connected to ${server.name} with project ${selectedProject.name}`);
      } catch (error) {
        console.error('Error connecting to MCP server:', error);
        toast.error(error instanceof Error ? error.message : `Failed to connect to ${server.name}`);
      } finally {
        setIsConnecting((prev) => ({ ...prev, [server.id]: false }));
      }
    } else {
      // Handle other server types
      setIsConnecting((prev) => ({ ...prev, [server.id]: true }));

      try {
        await connectMCPServer(server.id);
        logStore.logSystem('MCP server connected', {
          server: server.name,
          type: server.type,
        });
        toast.success(`Connected to ${server.name}`);
      } catch (error) {
        console.error('Error connecting to MCP server:', error);
        toast.error(error instanceof Error ? error.message : `Failed to connect to ${server.name}`);
      } finally {
        setIsConnecting((prev) => ({ ...prev, [server.id]: false }));
      }
    }
  };

  const handleDisconnect = (server: MCPServerConfig) => {
    try {
      disconnectMCPServer(server.id);
      logStore.logSystem('MCP server disconnected', {
        server: server.name,
        type: server.type,
      });
      toast.success(`Disconnected from ${server.name}`);
    } catch (error) {
      console.error('Error disconnecting from MCP server:', error);
      toast.error(`Failed to disconnect from ${server.name}`);
    }
  };

  const getServerIcon = (type: string) => {
    return SERVER_TYPE_ICONS[type as keyof typeof SERVER_TYPE_ICONS] || SERVER_TYPE_ICONS.default;
  };

  const getServerDescription = (type: string) => {
    return SERVER_TYPE_DESCRIPTIONS[type as keyof typeof SERVER_TYPE_DESCRIPTIONS] || SERVER_TYPE_DESCRIPTIONS.default;
  };

  const createOrganization = async (orgData: NewOrgFormData) => {
    const accessToken = getAuthToken();

    if (!accessToken) {
      setIsSupabaseAuthenticated(false);
      initiateSupabaseAuth();

      return;
    }

    setIsCreatingOrg(true);

    try {
      const response = await fetch('https://api.supabase.com/v1/organizations', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(orgData),
      });

      if (!response.ok) {
        const errorData = (await response.json()) as SupabaseAuthError;
        throw new Error(errorData.message || 'Failed to create organization');
      }

      const org = (await response.json()) as SupabaseOrg;
      setOrganizations((prev) => [...prev, org]);
      setSelectedOrg(org.id);
      toast.success('Organization created successfully');
      closeModal();
    } catch (error) {
      console.error('Error creating organization:', error);
      toast.error(error instanceof Error ? error.message : 'Failed to create organization');
    } finally {
      setIsCreatingOrg(false);
    }
  };

  // Add helper functions for modal management
  const openModal = (type: ModalType) => {
    setActiveModal(type);

    if (type === 'newOrg') {
      setNewOrgData({ name: '', billing_email: '' });
    } else if (type === 'newProject') {
      setNewProjectData({
        name: `project-${Date.now()}`,
        region: REGIONS[0].id,
        dbPass: '',
      });
    }
  };

  const closeModal = () => {
    setActiveModal(null);
  };

  return (
    <div className="space-y-6">
      {/* Authentication Status Section */}
      {!isSupabaseAuthenticated ? (
        <div className="p-4 border border-bolt-elements-borderColor rounded-lg bg-bolt-elements-background-depth-3">
          <div className="flex items-center gap-3 mb-4">
            <div className="p-2 rounded-lg bg-gradient-to-br from-cyan-500/20 via-violet-500/20 to-fuchsia-500/20 backdrop-blur-sm border border-white/5">
              <SiSupabase className="text-2xl text-white" />
            </div>
            <div>
              <h3 className="text-lg font-medium text-bolt-elements-textPrimary">Supabase </h3>
              <p className="text-sm text-bolt-elements-textSecondary">Connect to Supabase to manage your projects</p>
            </div>
          </div>
          <button
            onClick={initiateSupabaseAuth}
            disabled={isAuthenticating}
            className="w-full px-4 py-2 bg-cyan-500 text-white rounded-lg hover:bg-cyan-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
          >
            {isAuthenticating ? (
              <>
                <div className="i-ph:spinner animate-spin" />
                Connecting...
              </>
            ) : (
              <>
                <SiSupabase />
                Connect to Supabase
              </>
            )}
          </button>
        </div>
      ) : (
        <>
          {/* Organizations Section */}
          <div className="p-4 border border-bolt-elements-borderColor rounded-lg">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-medium text-bolt-elements-textPrimary">Supabase Organizations</h3>
              <button
                className="px-3 py-1 text-sm bg-cyan-500 text-white rounded-lg hover:bg-cyan-600 transition-colors"
                onClick={() => openModal('newOrg')}
              >
                New Organization
              </button>
            </div>

            {organizations.length > 0 ? (
              <div className="space-y-4">
                {organizations.map((org) => (
                  <div
                    key={org.id}
                    className={`p-4 border rounded-lg cursor-pointer transition-colors ${
                      selectedOrg === org.id
                        ? 'border-cyan-500 bg-cyan-500/10'
                        : 'border-bolt-elements-borderColor hover:border-cyan-500/50'
                    }`}
                    onClick={() => setSelectedOrg(org.id)}
                  >
                    <div className="flex items-center justify-between">
                      <div>
                        <h4 className="font-medium text-bolt-elements-textPrimary">{org.name}</h4>
                        <p className="text-sm text-bolt-elements-textSecondary">{org.billing_email}</p>
                      </div>
                      {selectedOrg === org.id && (
                        <button
                          className="px-3 py-1 text-sm bg-cyan-500 text-white rounded-lg hover:bg-cyan-600 transition-colors"
                          onClick={(e) => {
                            e.stopPropagation();
                            openModal('newProject');
                          }}
                        >
                          New Project
                        </button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-8">
                <p className="text-bolt-elements-textSecondary mb-4">No organizations found</p>
                <button
                  className="px-4 py-2 text-sm bg-cyan-500 text-white rounded-lg hover:bg-cyan-600 transition-colors"
                  onClick={() => openModal('newOrg')}
                >
                  Create Your First Organization
                </button>
              </div>
            )}
          </div>

          {/* Projects Section */}
          {selectedOrg && (
            <div className="p-4 border border-bolt-elements-borderColor rounded-lg">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-medium text-bolt-elements-textPrimary">Projects</h3>
                <button
                  className="px-3 py-1 text-sm bg-cyan-500 text-white rounded-lg hover:bg-cyan-600 transition-colors"
                  onClick={() => openModal('newProject')}
                >
                  New Project
                </button>
              </div>
              {projects.length > 0 ? (
                <div className="space-y-4">
                  {projects.map((project) => {
                    const status = PROJECT_STATUS[project.status] || PROJECT_STATUS.default;
                    return (
                      <div
                        key={project.id}
                        className="p-4 border border-bolt-elements-borderColor rounded-lg hover:border-cyan-500/50 transition-colors"
                      >
                        <div className="flex items-center justify-between mb-2">
                          <h4 className="font-medium text-bolt-elements-textPrimary flex items-center gap-2">
                            {project.name}
                            <div className={`flex items-center gap-1 text-sm ${status.color}`}>
                              <div className={status.icon} />
                              {status.label}
                            </div>
                          </h4>
                          <div className="flex items-center gap-2">
                            <button
                              className="p-2 text-bolt-elements-textSecondary hover:text-bolt-elements-textPrimary hover:bg-bolt-elements-background-depth-1 rounded-lg transition-colors"
                              onClick={() => window.open(`https://app.supabase.com/project/${project.id}`, '_blank')}
                            >
                              <div className="i-ph:external-link text-lg" />
                            </button>
                          </div>
                        </div>
                        <div className="grid grid-cols-2 gap-4 mt-4">
                          <div>
                            <p className="text-xs text-bolt-elements-textSecondary mb-1">Region</p>
                            <p className="text-sm text-bolt-elements-textPrimary flex items-center gap-1">
                              <div className="i-ph:globe" />
                              {REGIONS.find((r) => r.id === project.region)?.name || project.region}
                            </p>
                          </div>
                          <div>
                            <p className="text-xs text-bolt-elements-textSecondary mb-1">Created</p>
                            <p className="text-sm text-bolt-elements-textPrimary flex items-center gap-1">
                              <div className="i-ph:calendar" />
                              {new Date(project.created_at).toLocaleDateString()}
                            </p>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <div className="text-center py-8">
                  <p className="text-bolt-elements-textSecondary mb-4">No projects found</p>
                  <button
                    className="px-4 py-2 text-sm bg-cyan-500 text-white rounded-lg hover:bg-cyan-600 transition-colors"
                    onClick={() => openModal('newProject')}
                  >
                    Create Your First Project
                  </button>
                </div>
              )}
            </div>
          )}

          {/* MCP Servers Section - Only show Supabase servers */}
          {Object.values(mcpServers)
            .filter((server) => server.type === 'supabase')
            .map((server) => (
              <div
                key={server.id}
                className="p-4 border border-bolt-elements-borderColor rounded-lg bg-bolt-elements-background-depth-3"
              >
                <div className="flex items-center gap-3 mb-4">
                  <div className="p-2 rounded-lg bg-gradient-to-br from-cyan-500/20 via-violet-500/20 to-fuchsia-500/20 backdrop-blur-sm border border-white/5">
                    {getServerIcon(server.type)}
                  </div>
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <h3 className="text-lg font-medium text-bolt-elements-textPrimary">{server.name}</h3>
                      <span className="text-xs px-2 py-0.5 bg-bolt-elements-button-primary-background text-bolt-elements-button-primary-text rounded-full">
                        Beta
                      </span>
                    </div>
                    <p className="text-sm text-bolt-elements-textSecondary mt-1">{getServerDescription(server.type)}</p>
                  </div>
                </div>

                <div className="flex items-center">
                  {!server.isConnected ? (
                    <button
                      onClick={() => handleConnect(server)}
                      disabled={isConnecting[server.id]}
                      className="bg-bolt-elements-button-primary-background rounded-lg px-4 py-2 mr-2 transition-colors duration-200 hover:bg-bolt-elements-button-primary-backgroundHover text-bolt-elements-button-primary-text disabled:opacity-50 disabled:cursor-not-allowed flex items-center"
                    >
                      {isConnecting[server.id] ? (
                        <>
                          <div className="i-ph:spinner animate-spin mr-2" />
                          Connecting...
                        </>
                      ) : (
                        <>
                          <div className="i-ph:plug mr-2" />
                          Connect
                        </>
                      )}
                    </button>
                  ) : (
                    <button
                      onClick={() => handleDisconnect(server)}
                      className="bg-bolt-elements-button-danger-background rounded-lg px-4 py-2 mr-2 transition-colors duration-200 hover:bg-bolt-elements-button-danger-backgroundHover text-bolt-elements-button-danger-text"
                    >
                      Disconnect
                    </button>
                  )}
                  {server.isConnected && (
                    <span className="text-sm text-green-600 flex items-center">
                      <div className="i-ph:check-circle mr-1" />
                      Connected to {server.name}
                    </span>
                  )}
                </div>
              </div>
            ))}
        </>
      )}

      {/* Modals Portal */}
      {typeof document !== 'undefined' &&
        createPortal(
          <>
            {activeModal === 'newProject' && (
              <Dialog className="w-full max-w-md" onClose={closeModal}>
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-bolt-elements-textPrimary mb-1">
                      Project Name
                    </label>
                    <Input
                      type="text"
                      value={newProjectData.name}
                      onChange={(e) => setNewProjectData((prev) => ({ ...prev, name: e.target.value }))}
                      placeholder="my-awesome-project"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-bolt-elements-textPrimary mb-1">Region</label>
                    <select
                      value={newProjectData.region}
                      onChange={(e) => setNewProjectData((prev) => ({ ...prev, region: e.target.value }))}
                      className="w-full px-3 py-2 bg-bolt-elements-background-depth-1 border border-bolt-elements-borderColor rounded-lg focus:outline-none focus:ring-2 focus:ring-cyan-500/20"
                    >
                      {REGIONS.map((region) => (
                        <option key={region.id} value={region.id}>
                          {region.name}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-bolt-elements-textPrimary mb-1">
                      Database Password
                    </label>
                    <Input
                      type="password"
                      value={newProjectData.dbPass}
                      onChange={(e) => setNewProjectData((prev) => ({ ...prev, dbPass: e.target.value }))}
                      placeholder="Strong password for your database"
                    />
                    <p className="mt-1 text-xs text-bolt-elements-textSecondary">Must be at least 6 characters long</p>
                  </div>
                </div>

                <div className="mt-6 flex justify-end gap-2">
                  <button
                    onClick={closeModal}
                    className="px-4 py-2 text-sm text-bolt-elements-textPrimary hover:bg-bolt-elements-background-depth-1 rounded-lg transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={() => createProject(selectedOrg!, newProjectData)}
                    disabled={isCreatingProject || !newProjectData.name || !newProjectData.dbPass}
                    className="px-4 py-2 text-sm bg-cyan-500 text-white rounded-lg hover:bg-cyan-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                  >
                    {isCreatingProject ? (
                      <>
                        <div className="i-ph:spinner animate-spin" />
                        Creating...
                      </>
                    ) : (
                      'Create Project'
                    )}
                  </button>
                </div>
              </Dialog>
            )}

            {activeModal === 'newOrg' && (
              <Dialog className="w-full max-w-md" onClose={closeModal}>
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-bolt-elements-textPrimary mb-1">
                      Organization Name
                    </label>
                    <Input
                      type="text"
                      value={newOrgData.name}
                      onChange={(e) => setNewOrgData((prev) => ({ ...prev, name: e.target.value }))}
                      placeholder="My Organization"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-bolt-elements-textPrimary mb-1">
                      Billing Email
                    </label>
                    <Input
                      type="email"
                      value={newOrgData.billing_email}
                      onChange={(e) => setNewOrgData((prev) => ({ ...prev, billing_email: e.target.value }))}
                      placeholder="billing@example.com"
                    />
                  </div>
                </div>

                <div className="mt-6 flex justify-end gap-2">
                  <button
                    onClick={closeModal}
                    className="px-4 py-2 text-sm text-bolt-elements-textPrimary hover:bg-bolt-elements-background-depth-1 rounded-lg transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={() => createOrganization(newOrgData)}
                    disabled={isCreatingOrg || !newOrgData.name || !newOrgData.billing_email}
                    className="px-4 py-2 text-sm bg-cyan-500 text-white rounded-lg hover:bg-cyan-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                  >
                    {isCreatingOrg ? (
                      <>
                        <div className="i-ph:spinner animate-spin" />
                        Creating...
                      </>
                    ) : (
                      'Create Organization'
                    )}
                  </button>
                </div>
              </Dialog>
            )}
          </>,
          document.body,
        )}
    </div>
  );
}
