import { atom, map } from 'nanostores';
import Cookies from 'js-cookie';

export interface MCPServerConfig {
  id: string;
  name: string;
  url: string;
  type: string;
  credentials?: Record<string, string>;
  isConnected: boolean;
}

interface ErrorResponse {
  message: string;
}

export const mcpServersStore = map<Record<string, MCPServerConfig>>({});

export const activeMCPServer = atom<string | null>(null);

// Initialize Supabase MCP Server with proper configuration
const supabaseMCP: MCPServerConfig = {
  id: 'supabase-mcp',
  name: 'Supabase',
  url: '/api/mcp/supabase', // Changed to use relative API endpoint
  type: 'supabase',
  isConnected: false,
};

// Load saved MCP configurations from cookies
export function initMCPServers() {
  const savedConfigs = Cookies.get('mcpServers');
  const supabaseAccessToken = Cookies.get('supabaseAccessToken');
  const supabaseOrgId = Cookies.get('supabaseOrgId');

  if (savedConfigs) {
    try {
      const configs = JSON.parse(savedConfigs);
      mcpServersStore.set(configs);
    } catch (error) {
      console.error('Error loading MCP configurations:', error);
      mcpServersStore.set({ [supabaseMCP.id]: supabaseMCP });
    }
  } else {
    // Initialize with default Supabase MCP
    mcpServersStore.set({ [supabaseMCP.id]: supabaseMCP });
  }

  // If Supabase credentials exist, try to reconnect
  if (supabaseAccessToken && supabaseOrgId) {
    const config = mcpServersStore.get()[supabaseMCP.id];

    if (config && !config.isConnected) {
      connectMCPServer(supabaseMCP.id, {
        accessToken: supabaseAccessToken,
        orgId: supabaseOrgId,
      });
    }
  }
}

// Save MCP configurations to cookies
export function saveMCPServers() {
  const configs = mcpServersStore.get();
  Cookies.set('mcpServers', JSON.stringify(configs), { expires: 30 });
}

// Add or update MCP server
export function updateMCPServer(config: MCPServerConfig) {
  mcpServersStore.setKey(config.id, config);
  saveMCPServers();
}

// Remove MCP server
export function removeMCPServer(id: string) {
  const configs = mcpServersStore.get();
  delete configs[id];
  mcpServersStore.set(configs);
  saveMCPServers();
}

// Set active MCP server
export function setActiveMCPServer(id: string | null) {
  activeMCPServer.set(id);
  Cookies.set('activeMCPServer', id || '', { expires: 30 });
}

// Connect to MCP server with improved error handling
export async function connectMCPServer(id: string, credentials?: Record<string, string>) {
  const configs = mcpServersStore.get();
  const config = configs[id];

  if (!config) {
    throw new Error('MCP server configuration not found');
  }

  try {
    // For Supabase MCP, verify Supabase connection first
    if (config.type === 'supabase') {
      const supabaseAccessToken = Cookies.get('supabaseAccessToken');
      const supabaseOrgId = Cookies.get('supabaseOrgId');

      if (!supabaseAccessToken) {
        throw new Error('Please connect to Supabase first by clicking the Supabase button in the Extensions menu.');
      }

      if (!supabaseOrgId) {
        throw new Error('Please select a Supabase organization before connecting to the MCP server.');
      }

      credentials = {
        accessToken: supabaseAccessToken,
        orgId: supabaseOrgId,
      };
    }

    // Make HTTP request to validate connection
    const response = await fetch(config.url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(credentials?.accessToken && { Authorization: `Bearer ${credentials.accessToken}` }),
      },
      body: JSON.stringify({
        type: config.type,
        credentials,
      }),
    });

    if (!response.ok) {
      const errorData = (await response.json()) as ErrorResponse;
      throw new Error(errorData.message || `Failed to connect to ${config.name}`);
    }

    // Update server config with validated credentials
    config.credentials = credentials;
    config.isConnected = true;
    mcpServersStore.setKey(id, config);
    saveMCPServers();

    return true;
  } catch (error) {
    console.error('Error connecting to MCP server:', error);
    throw error;
  }
}

// Disconnect from MCP server
export function disconnectMCPServer(id: string) {
  const configs = mcpServersStore.get();
  const config = configs[id];

  if (!config) {
    return;
  }

  config.credentials = undefined;
  config.isConnected = false;
  mcpServersStore.setKey(id, config);
  saveMCPServers();

  if (activeMCPServer.get() === id) {
    setActiveMCPServer(null);
  }
}
