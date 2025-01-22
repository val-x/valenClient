/**
 * app/routes/cluster.tsx is using https://github.com/exo-explore/exo.git behind the scenes.
 *
 * Wide Model Support:
 * exo supports different models including LLaMA (MLX and tinygrad), Mistral, LlaVA,
 * Qwen, and Deepseek.
 *
 * Dynamic Model Partitioning:
 * exo optimally splits up models based on the current network topology and device
 * resources available. This enables running larger models than possible on any single device.
 *
 * Automatic Device Discovery:
 * exo automatically discovers other devices using the best method available with zero
 * manual configuration needed.
 *
 * ChatGPT-compatible API:
 * exo provides a ChatGPT-compatible API for running models, requiring just a one-line
 * change to run models on your own hardware.
 *
 * Device Equality:
 * Unlike master-worker architectures, exo devices connect p2p. Any device connected
 * anywhere in the network can be used to run models.
 *
 * Partitioning Strategy:
 * exo supports different partitioning strategies, defaulting to ring memory weighted
 * partitioning where each device runs model layers proportional to its memory capacity.
 */

// Third-party imports first
import { json } from '@remix-run/cloudflare';
import { useLoaderData } from '@remix-run/react';
import { motion, AnimatePresence } from 'framer-motion';
import { useState, useEffect } from 'react';

// Local imports after a blank line
import { Dialog, DialogButton, DialogDescription, DialogRoot, DialogTitle } from '~/components/ui/Dialog';
import { Header } from '~/components/header/Header';

declare global {
  interface Window {
    electron: {
      invoke(channel: 'shell:execute', command: string): Promise<string>;
      invoke(channel: 'os:platform'): Promise<'win32' | 'darwin' | 'linux'>;
      invoke(channel: 'os:homedir'): Promise<string>;
      invoke(channel: 'os:elevate'): Promise<boolean>;
      invoke(channel: 'os:isAdmin'): Promise<boolean>;
      invoke(channel: 'os:relaunch', args: { elevated: boolean }): Promise<void>;
    };
  }
}

interface NodePosition {
  x: number;
  y: number;
}

interface ClusterNode {
  id: string;
  type: string;
  status: 'active' | 'inactive';
  gpu: {
    name: string;
    tflops: number;
    utilization: number[];
  };
  position?: NodePosition;
}

// Add new interface for node details
interface NodeDetails {
  cpuUsage: number;
  memoryTotal: number;
  memoryUsed: number;
  diskSpace: {
    total: number;
    used: number;
  };
  uptime: string;
  temperature: number;
  lastSeen: string;
}

// Add new interface for system checks
interface SystemCheck {
  name: string;
  status: 'pending' | 'success' | 'error' | 'running';
  message?: string;
}

// Add new interface for terminal output
interface TerminalLine {
  content: string;
  type: 'input' | 'output' | 'error';
  timestamp: number;
}

// Add new interface for setup status
interface SetupStatus {
  hasTerminalAccess: boolean;
  pythonInstalled: boolean;
  nvidiaDriverInstalled: boolean;
  cudaInstalled: boolean;
  cudnnInstalled: boolean;
  repoCloned: boolean;
}

export async function loader() {
  return json({
    clusterInfo: {
      status: 'connected',
      nodes: [
        {
          id: 'node-1',
          type: 'Linux Box',
          status: 'active',
          gpu: {
            name: 'NVIDIA GEFORCE RTX 3060 TI',
            tflops: 32.4,
            utilization: [0.77, 0.92],
          },
        },
        {
          id: 'node-2',
          type: 'Linux Box',
          status: 'active',
          gpu: {
            name: 'NVIDIA GEFORCE GTX 1050 TI',
            tflops: 4.0,
            utilization: [0.92, 1.0],
          },
        },
        {
          id: 'node-3',
          type: 'MacBook Pro 16GB',
          status: 'active',
          gpu: {
            name: 'Integrated',
            tflops: 10.6,
            utilization: [0.0, 0.31],
          },
        },
        {
          id: 'node-4',
          type: 'Linux Box',
          status: 'active',
          gpu: {
            name: 'NVIDIA GEFORCE RTX 4060 TI',
            tflops: 44.0,
            utilization: [0.31, 0.62],
          },
        },
      ] as ClusterNode[],
      urls: {
        webChat: 'http://192.168.0.106:8000',
        apiEndpoint: 'http://192.168.0.106:8000/v1/chat/completions',
      },
    },
  });
}

// Update the curve generation function for better node connections
const generateCurvePath = (start: { x: number; y: number }, end: { x: number; y: number }, isToHub: boolean) => {
  if (isToHub) {
    // Smoother curve for hub connections
    const dx = end.x - start.x;
    const dy = end.y - start.y;
    const distance = Math.sqrt(dx * dx + dy * dy);
    const curvature = distance * 0.2;

    // Calculate control point perpendicular to the line
    const mx = (start.x + end.x) / 2;
    const my = (start.y + end.y) / 2;
    const angle = Math.atan2(dy, dx) + Math.PI / 2;
    const controlX = mx + Math.cos(angle) * curvature;
    const controlY = my + Math.sin(angle) * curvature;

    return `M ${start.x} ${start.y} Q ${controlX} ${controlY} ${end.x} ${end.y}`;
  } else {
    // Curved connection between nodes with dynamic curvature
    const dx = end.x - start.x;
    const dy = end.y - start.y;
    const distance = Math.sqrt(dx * dx + dy * dy);
    const curvature = distance * 0.3;

    // Calculate control points
    const mx = (start.x + end.x) / 2;
    const my = (start.y + end.y) / 2;
    const angle = Math.atan2(dy, dx) + Math.PI / 2;
    const controlX1 = mx + Math.cos(angle) * curvature;
    const controlY1 = my + Math.sin(angle) * curvature;

    return `M ${start.x} ${start.y} 
            C ${controlX1} ${controlY1} 
              ${controlX1} ${controlY1} 
              ${end.x} ${end.y}`;
  }
};

// Add this function at the top level
const calculateClusterUtilization = (nodes: ClusterNode[]) => {
  const totalUtilization = nodes.reduce((acc, node) => acc + node.gpu.utilization[1], 0);
  return (totalUtilization / nodes.length) * 100;
};

export default function Cluster() {
  const { clusterInfo } = useLoaderData<typeof loader>();
  const [isConnecting, setIsConnecting] = useState(false);
  const [selectedNode, setSelectedNode] = useState<string | null>(null);
  const [showConfigModal, setShowConfigModal] = useState(false);

  // Add new state for node interactions
  const [hoveredNode, setHoveredNode] = useState<string | null>(null);

  // Calculate center position for the main node
  const centerPosition = { x: 50, y: 50 }; // percentage

  // Add animation state for the central hub
  const [isHubPulsing, setIsHubPulsing] = useState(true);

  // Calculate current cluster utilization
  const currentUtilization = calculateClusterUtilization(clusterInfo.nodes);

  // Update the node positions calculation for better layout
  const getNodePositions = (nodeCount: number) => {
    const radius = 35; // Base radius
    const angleOffset = Math.PI / nodeCount; // Offset for better distribution

    return Array.from({ length: nodeCount }).map((_, index) => {
      const angle = (index * 2 * Math.PI) / nodeCount + angleOffset;
      // Add slight random variation to positions for more organic look
      const radiusVariation = radius + (Math.random() - 0.5) * 3;
      return {
        x: centerPosition.x + radiusVariation * Math.cos(angle),
        y: centerPosition.y + radiusVariation * Math.sin(angle),
      };
    });
  };

  const getUtilizationColor = (value: number) => {
    if (value < 0.3) return 'from-red-500 to-red-600';
    if (value < 0.6) return 'from-yellow-500 to-yellow-600';
    return 'from-emerald-500 to-emerald-600';
  };

  // Add connection generation with better patterns
  const generateConnections = (nodes: ClusterNode[], positions: Array<{ x: number; y: number }>) => {
    const connections: Array<{
      from: number;
      to: number;
      path: string;
      type: 'hub' | 'mesh';
    }> = [];

    // Hub connections (spoke pattern)
    positions.forEach((pos, index) => {
      connections.push({
        from: index,
        to: -1,
        path: generateCurvePath(pos, { x: 50, y: 50 }, true),
        type: 'hub',
      });
    });

    // Mesh connections (circular pattern)
    positions.forEach((startPos, i) => {
      // Connect to next node
      const nextIndex = (i + 1) % positions.length;
      connections.push({
        from: i,
        to: nextIndex,
        path: generateCurvePath(startPos, positions[nextIndex], false),
        type: 'mesh',
      });

      // Add cross connections for more resilience
      if (positions.length > 3) {
        const crossIndex = (i + 2) % positions.length;
        connections.push({
          from: i,
          to: crossIndex,
          path: generateCurvePath(startPos, positions[crossIndex], false),
          type: 'mesh',
        });
      }
    });

    return connections;
  };

  // Add state for node details modal
  const [selectedNodeDetails, setSelectedNodeDetails] = useState<(ClusterNode & { details: NodeDetails }) | null>(null);

  // Add function to get node details (mock data for now)
  const getNodeDetails = (node: ClusterNode): NodeDetails => ({
    cpuUsage: 45 + Math.random() * 30,
    memoryTotal: 32,
    memoryUsed: 16 + Math.random() * 8,
    diskSpace: {
      total: 512,
      used: 256 + Math.random() * 128,
    },
    uptime: '5d 12h 34m',
    temperature: 55 + Math.random() * 20,
    lastSeen: new Date().toISOString(),
  });

  // Add state for system checks
  const [systemChecks, setSystemChecks] = useState<SystemCheck[]>([
    { name: 'Python Version', status: 'pending' },
    { name: 'NVIDIA Driver', status: 'pending' },
    { name: 'CUDA Toolkit', status: 'pending' },
    { name: 'cuDNN Library', status: 'pending' },
    { name: 'Repository Clone', status: 'pending' },
  ]);

  // Add function to run system checks
  const runSystemChecks = async () => {
    // Update Python check
    setSystemChecks((prev) =>
      prev.map((check) => (check.name === 'Python Version' ? { ...check, status: 'running' } : check)),
    );

    try {
      const pythonVersion = await window.electron.invoke('shell:execute', 'python3 --version');
      const version = pythonVersion.match(/\d+\.\d+\.\d+/)?.[0] || '0.0.0';

      setSystemChecks((prev) =>
        prev.map((check) =>
          check.name === 'Python Version'
            ? {
                ...check,
                status: version >= '3.12.0' ? 'success' : 'error',
                message:
                  version >= '3.12.0'
                    ? `Python ${version} detected`
                    : `Python ${version} detected. Version >=3.12.0 required`,
              }
            : check,
        ),
      );
    } catch (error) {
      setSystemChecks((prev) =>
        prev.map((check) =>
          check.name === 'Python Version' ? { ...check, status: 'error', message: 'Python not found' } : check,
        ),
      );
    }

    // Check NVIDIA components on Linux
    if ((await window.electron.invoke('os:platform')) === 'linux') {
      // Check NVIDIA Driver
      try {
        await window.electron.invoke('shell:execute', 'nvidia-smi');
        setSystemChecks((prev) =>
          prev.map((check) =>
            check.name === 'NVIDIA Driver' ? { ...check, status: 'success', message: 'NVIDIA driver detected' } : check,
          ),
        );
      } catch {
        setSystemChecks((prev) =>
          prev.map((check) =>
            check.name === 'NVIDIA Driver' ? { ...check, status: 'error', message: 'NVIDIA driver not found' } : check,
          ),
        );
      }

      // Check CUDA
      try {
        const cudaVersion = await window.electron.invoke('shell:execute', 'nvcc --version');
        setSystemChecks((prev) =>
          prev.map((check) =>
            check.name === 'CUDA Toolkit' ? { ...check, status: 'success', message: 'CUDA toolkit detected' } : check,
          ),
        );
      } catch {
        setSystemChecks((prev) =>
          prev.map((check) =>
            check.name === 'CUDA Toolkit' ? { ...check, status: 'error', message: 'CUDA toolkit not found' } : check,
          ),
        );
      }
    }

    // Clone repository
    try {
      const homeDir = await window.electron.invoke('os:homedir');
      const repoPath = `${homeDir}/.val-x/exo`;

      await window.electron.invoke(
        'shell:execute',
        `
        mkdir -p ${repoPath} &&
        cd ${repoPath} &&
        git clone https://github.com/exo-explore/exo.git . || git pull
      `,
      );

      setSystemChecks((prev) =>
        prev.map((check) =>
          check.name === 'Repository Clone'
            ? { ...check, status: 'success', message: 'Repository cloned successfully' }
            : check,
        ),
      );
    } catch (error) {
      setSystemChecks((prev) =>
        prev.map((check) =>
          check.name === 'Repository Clone'
            ? { ...check, status: 'error', message: 'Failed to clone repository' }
            : check,
        ),
      );
    }
  };

  // Add terminal state
  const [terminalLines, setTerminalLines] = useState<TerminalLine[]>([
    {
      content: '$ Welcome to Val-X Terminal',
      type: 'output',
      timestamp: Date.now(),
    },
  ]);
  const [isExecuting, setIsExecuting] = useState(false);

  // Add state for command input
  const [commandInput, setCommandInput] = useState('');

  // Add function to execute shell commands
  const executeCommand = async (command: string) => {
    try {
      setIsExecuting(true);
      setTerminalLines((prev) => [...prev, { content: `$ ${command}`, type: 'input', timestamp: Date.now() }]);

      const output = await window.electron.invoke('shell:execute', command);

      setTerminalLines((prev) => [...prev, { content: output, type: 'output', timestamp: Date.now() }]);
    } catch (error) {
      setTerminalLines((prev) => [
        ...prev,
        {
          content: `Error: ${error instanceof Error ? error.message : 'Unknown error'}`,
          type: 'error',
          timestamp: Date.now(),
        },
      ]);
    } finally {
      setIsExecuting(false);
    }
  };

  // Add function to handle command submission
  const handleCommandSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!commandInput.trim()) return;

    await executeCommand(commandInput);
    setCommandInput('');
  };

  // Add state for setup process
  const [setupStep, setSetupStep] = useState<'init' | 'prerequisites' | 'terminal'>('init');
  const [osType, setOsType] = useState<'linux' | 'windows' | 'unknown'>('unknown');

  // Add function to detect OS
  const detectOS = async () => {
    try {
      const platform = await window.electron.invoke('os:platform');
      setOsType(platform === 'win32' ? 'windows' : platform === 'linux' ? 'linux' : 'unknown');
    } catch (error) {
      console.error('Failed to detect OS:', error);
    }
  };

  // Add setup status state
  const [setupStatus, setSetupStatus] = useState<SetupStatus>({
    hasTerminalAccess: false,
    pythonInstalled: false,
    nvidiaDriverInstalled: false,
    cudaInstalled: false,
    cudnnInstalled: false,
    repoCloned: false,
  });

  // Add function to check admin status
  const checkAdminStatus = async () => {
    try {
      const isAdmin = await window.electron.invoke('os:isAdmin');
      if (!isAdmin) {
        setTerminalLines((prev) => [
          ...prev,
          {
            content: 'Not running with administrator privileges. Requesting elevation...',
            type: 'error',
            timestamp: Date.now(),
          },
        ]);
        return false;
      }
      setTerminalLines((prev) => [
        ...prev,
        { content: 'Running with administrator privileges', type: 'output', timestamp: Date.now() },
      ]);
      return true;
    } catch (error) {
      console.error('Failed to check admin status:', error);
      return false;
    }
  };

  // Update the requestElevatedPrivileges function
  const requestElevatedPrivileges = async () => {
    try {
      setIsExecuting(true);
      setTerminalLines((prev) => [
        ...prev,
        { content: '$ Requesting elevated privileges...', type: 'input', timestamp: Date.now() },
      ]);

      // First check if we're already admin
      const isAdmin = await checkAdminStatus();
      if (isAdmin) {
        setSetupStatus((prev) => ({ ...prev, hasTerminalAccess: true }));
        return true;
      }

      // Request elevation by relaunching the app
      await window.electron.invoke('os:relaunch', { elevated: true });

      setTerminalLines((prev) => [
        ...prev,
        { content: 'Application relaunching with elevated privileges...', type: 'output', timestamp: Date.now() },
      ]);

      return true;
    } catch (error) {
      setTerminalLines((prev) => [
        ...prev,
        {
          content: `Error: ${error instanceof Error ? error.message : 'Failed to request elevated privileges'}`,
          type: 'error',
          timestamp: Date.now(),
        },
      ]);
      return false;
    } finally {
      setIsExecuting(false);
    }
  };

  // Add back the runSetupScript function
  const runSetupScript = async () => {
    try {
      setIsExecuting(true);

      // First check terminal access
      const isAdmin = await checkAdminStatus();
      if (!isAdmin) {
        setTerminalLines((prev) => [
          ...prev,
          {
            content: 'Error: Administrator privileges required to install prerequisites',
            type: 'error',
            timestamp: Date.now(),
          },
        ]);
        return;
      }

      // Run the appropriate installation script
      const command =
        osType === 'linux'
          ? 'curl -fsSL https://val-x.in/install | bash'
          : 'powershell -c "irm val-x.in/install.ps1 | iex"';

      setTerminalLines((prev) => [
        ...prev,
        { content: `$ Running Val-X setup script...`, type: 'input', timestamp: Date.now() },
      ]);

      const output = await window.electron.invoke('shell:execute', command);

      setTerminalLines((prev) => [...prev, { content: output, type: 'output', timestamp: Date.now() }]);

      // Check installations
      await verifyInstallations();

      setTerminalLines((prev) => [
        ...prev,
        { content: '$ Setup completed successfully', type: 'output', timestamp: Date.now() },
      ]);

      setSetupStep('terminal');
    } catch (error) {
      setTerminalLines((prev) => [
        ...prev,
        {
          content: `Error: ${error instanceof Error ? error.message : 'Failed to run setup script'}`,
          type: 'error',
          timestamp: Date.now(),
        },
      ]);
    } finally {
      setIsExecuting(false);
    }
  };

  // Add back the verifyInstallations function
  const verifyInstallations = async () => {
    // Check Python
    try {
      const pythonVersion = await window.electron.invoke('shell:execute', 'python3 --version');
      const version = pythonVersion.match(/\d+\.\d+\.\d+/)?.[0] || '0.0.0';
      setSetupStatus((prev) => ({ ...prev, pythonInstalled: version >= '3.12.0' }));
    } catch {
      setSetupStatus((prev) => ({ ...prev, pythonInstalled: false }));
    }

    // Check NVIDIA components on Linux
    if (osType === 'linux') {
      try {
        await window.electron.invoke('shell:execute', 'nvidia-smi');
        setSetupStatus((prev) => ({ ...prev, nvidiaDriverInstalled: true }));
      } catch {
        setSetupStatus((prev) => ({ ...prev, nvidiaDriverInstalled: false }));
      }

      try {
        await window.electron.invoke('shell:execute', 'nvcc --version');
        setSetupStatus((prev) => ({ ...prev, cudaInstalled: true }));
      } catch {
        setSetupStatus((prev) => ({ ...prev, cudaInstalled: false }));
      }
    }

    // Check repository
    try {
      const homeDir = await window.electron.invoke('os:homedir');
      const repoPath = `${homeDir}/.val-x/exo`;
      await window.electron.invoke('shell:execute', `test -d ${repoPath}/.git`);
      setSetupStatus((prev) => ({ ...prev, repoCloned: true }));
    } catch {
      setSetupStatus((prev) => ({ ...prev, repoCloned: false }));
    }
  };

  // Update the initial checks
  useEffect(() => {
    if (showConfigModal && setupStep === 'init') {
      detectOS();
      checkAdminStatus().then((isAdmin) => {
        if (isAdmin) {
          setSetupStatus((prev) => ({ ...prev, hasTerminalAccess: true }));
        }
      });
    }
  }, [showConfigModal, setupStep]);

  return (
    <div className="min-h-screen bg-black">
      <Header />

      {/* Add margin-top to account for fixed header */}
      <div className="container mx-auto px-4 py-8 mt-20">
        <div className="max-w-6xl mx-auto space-y-6">
          {/* Header Section */}
          <motion.div initial={{ opacity: 0, y: -20 }} animate={{ opacity: 1, y: 0 }} className="text-center mb-12">
            <h1 className="text-4xl font-bold bg-gradient-to-r from-cyan-400 via-violet-400 to-fuchsia-400 bg-clip-text text-transparent mb-4">
              Val-X Cluster Management
            </h1>
            <p className="text-gray-400">
              Connected Nodes: <span className="text-white font-semibold">{clusterInfo.nodes.length}</span>
            </p>
          </motion.div>

          {/* Status Overview */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="grid grid-cols-1 md:grid-cols-2 gap-6"
          >
            {/* Connection Status */}
            <div className="bg-black/40 backdrop-blur-xl border border-white/10 rounded-xl p-6">
              <div className="flex items-center gap-3 mb-4">
                <div className="p-3 rounded-lg bg-gradient-to-br from-cyan-500/20 to-violet-500/20">
                  <div className="i-ph:plug-duotone text-2xl text-cyan-400" />
                </div>
                <div>
                  <h2 className="text-lg font-semibold text-white">Connection Status</h2>
                  <p className="text-sm text-gray-400">Cluster network status</p>
                </div>
              </div>
              <div className="flex items-center gap-2 p-3 bg-black/40 rounded-lg mb-4">
                <div
                  className={`w-3 h-3 rounded-full ${
                    clusterInfo.status === 'connected' ? 'bg-emerald-400' : 'bg-red-400'
                  }`}
                />
                <span className="text-white capitalize">{clusterInfo.status}</span>
              </div>

              {/* Stats Section */}
              <div className="space-y-3 text-sm">
                <div className="flex items-center justify-between p-2 rounded bg-black/20">
                  <span className="text-gray-400">Val-X decentralized AI</span>
                </div>
                <div className="flex items-center justify-between p-2 rounded bg-black/20">
                  <span className="text-gray-400">Val-X Chat URL:</span>
                  <span className="text-white font-mono text-xs truncate ml-2">{clusterInfo.urls.webChat}</span>
                </div>
                <div className="flex items-center justify-between p-2 rounded bg-black/20">
                  <span className="text-gray-400">Val-X API Endpoint:</span>
                  <span className="text-white font-mono text-xs truncate ml-2">{clusterInfo.urls.apiEndpoint}</span>
                </div>
              </div>
            </div>

            {/* GPU Overview */}
            <div className="bg-black/40 backdrop-blur-xl border border-white/10 rounded-xl p-6">
              <div className="flex items-center gap-3 mb-6">
                <div className="p-3 rounded-lg bg-gradient-to-br from-violet-500/20 to-fuchsia-500/20">
                  <div className="i-ph:chart-bar-duotone text-2xl text-violet-400" />
                </div>
                <div>
                  <h2 className="text-lg font-semibold text-white">GPU Utilization</h2>
                  <p className="text-sm text-gray-400">Cluster performance metrics</p>
                </div>
              </div>

              {/* GPU Utilization Meter */}
              <div className="space-y-4">
                {/* Current Usage Gauge */}
                <div className="relative h-24">
                  <div className="absolute inset-x-0 bottom-0 h-16 bg-black/40 rounded-lg overflow-hidden">
                    {/* Background Gradient Bars */}
                    <div className="flex h-full">
                      {Array.from({ length: 50 }).map((_, i) => (
                        <div
                          key={i}
                          className={`flex-1 ${
                            i < 15
                              ? 'bg-gradient-to-t from-cyan-500/20 to-cyan-500/5'
                              : i < 30
                                ? 'bg-gradient-to-t from-violet-500/20 to-violet-500/5'
                                : 'bg-gradient-to-t from-fuchsia-500/20 to-fuchsia-500/5'
                          }`}
                        />
                      ))}
                    </div>

                    {/* Active Usage Indicator */}
                    <motion.div
                      className="absolute bottom-0 left-0 h-full bg-gradient-to-r from-cyan-500/20 via-violet-500/20 to-fuchsia-500/20 backdrop-blur-sm"
                      initial={{ width: '0%' }}
                      animate={{ width: `${currentUtilization}%` }}
                      transition={{ duration: 1 }}
                    >
                      <div className="absolute top-0 right-0 h-full w-1 bg-gradient-to-b from-white via-violet-400 to-cyan-400" />
                    </motion.div>

                    {/* Usage Pointer */}
                    <motion.div
                      className="absolute top-0 h-full"
                      initial={{ left: '0%' }}
                      animate={{ left: `${currentUtilization}%` }}
                      transition={{ duration: 1 }}
                    >
                      <div className="absolute -top-6 -translate-x-1/2 flex flex-col items-center">
                        <div className="text-cyan-400 text-sm font-bold">{currentUtilization.toFixed(1)}%</div>
                        <div className="w-px h-6 bg-gradient-to-b from-cyan-400 to-transparent" />
                      </div>
                    </motion.div>

                    {/* Usage Labels */}
                    <div className="absolute bottom-1 left-2 text-[10px] text-gray-400">0%</div>
                    <div className="absolute bottom-1 right-2 text-[10px] text-gray-400">100%</div>
                  </div>
                </div>

                {/* GPU Stats Grid */}
                <div className="grid grid-cols-2 gap-3">
                  {/* Total TFLOPS */}
                  <div className="bg-black/40 rounded-lg p-3 border border-white/5">
                    <div className="text-xs text-gray-400 mb-1">Total TFLOPS</div>
                    <div className="text-lg font-bold bg-gradient-to-r from-cyan-400 to-violet-400 bg-clip-text text-transparent">
                      {clusterInfo.nodes.reduce((acc, node) => acc + node.gpu.tflops, 0).toFixed(1)}
                    </div>
                  </div>

                  {/* Active GPUs */}
                  <div className="bg-black/40 rounded-lg p-3 border border-white/5">
                    <div className="text-xs text-gray-400 mb-1">Active GPUs</div>
                    <div className="text-lg font-bold bg-gradient-to-r from-violet-400 to-fuchsia-400 bg-clip-text text-transparent">
                      {clusterInfo.nodes.filter((node) => node.status === 'active').length}
                    </div>
                  </div>

                  {/* Memory Usage */}
                  <div className="bg-black/40 rounded-lg p-3 border border-white/5">
                    <div className="text-xs text-gray-400 mb-1">Memory Usage</div>
                    <div className="flex items-end gap-1">
                      <span className="text-lg font-bold bg-gradient-to-r from-cyan-400 to-violet-400 bg-clip-text text-transparent">
                        24.5
                      </span>
                      <span className="text-xs text-gray-400">GB</span>
                    </div>
                  </div>

                  {/* Temperature */}
                  <div className="bg-black/40 rounded-lg p-3 border border-white/5">
                    <div className="text-xs text-gray-400 mb-1">Avg. Temperature</div>
                    <div className="flex items-end gap-1">
                      <span className="text-lg font-bold bg-gradient-to-r from-violet-400 to-fuchsia-400 bg-clip-text text-transparent">
                        65
                      </span>
                      <span className="text-xs text-gray-400">°C</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </motion.div>

          {/* Nodes Graph */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
            className="bg-black/40 backdrop-blur-xl border border-white/10 rounded-xl p-6 h-[600px] relative overflow-hidden"
          >
            {/* Background Grid */}
            <div className="absolute inset-0 bg-[linear-gradient(to_right,#22222220_1px,transparent_1px),linear-gradient(to_bottom,#22222220_1px,transparent_1px)] bg-[size:20px_20px]" />

            <svg className="absolute inset-0 w-full h-full">
              <defs>
                <linearGradient id="lineGradient" x1="0%" y1="0%" x2="100%" y2="0%">
                  <stop offset="0%" stopColor="#22D3EE" stopOpacity="0.2" />
                  <stop offset="100%" stopColor="#A78BFA" stopOpacity="0.2" />
                </linearGradient>
                <filter id="glow">
                  <feGaussianBlur stdDeviation="2" result="coloredBlur" />
                  <feMerge>
                    <feMergeNode in="coloredBlur" />
                    <feMergeNode in="SourceGraphic" />
                  </feMerge>
                </filter>
                {/* Add pulse animation */}
                <radialGradient id="hubGradient" cx="50%" cy="50%" r="50%">
                  <stop offset="0%" stopColor="#22D3EE" stopOpacity="0.4" />
                  <stop offset="100%" stopColor="#22D3EE" stopOpacity="0" />
                </radialGradient>
              </defs>

              {/* Hub Pulse Effect */}
              <motion.circle
                cx="50%"
                cy="50%"
                r="30"
                fill="url(#hubGradient)"
                initial={{ scale: 0.8, opacity: 0.5 }}
                animate={{ scale: 1.2, opacity: 0 }}
                transition={{
                  repeat: Infinity,
                  duration: 2,
                  ease: 'easeInOut',
                }}
              />

              {/* Central Hub */}
              <motion.circle
                cx="50%"
                cy="50%"
                r="20"
                className="fill-cyan-500/20 stroke-cyan-400"
                strokeWidth="1.5"
                filter="url(#glow)"
                animate={{
                  scale: isHubPulsing ? [1, 1.1, 1] : 1,
                }}
                transition={{
                  duration: 2,
                  repeat: Infinity,
                  ease: 'easeInOut',
                }}
              />

              {/* Connection Lines with Animation */}
              {(() => {
                const positions = getNodePositions(clusterInfo.nodes.length);
                const connections = generateConnections(clusterInfo.nodes, positions);

                return connections.map((connection, index) => {
                  const isHubConnection = connection.to === -1;
                  const fromNode = clusterInfo.nodes[connection.from];
                  const toNode = connection.to === -1 ? null : clusterInfo.nodes[connection.to];

                  return (
                    <g key={`${connection.from}-${connection.to}`}>
                      <motion.path
                        d={connection.path}
                        stroke="url(#lineGradient)"
                        strokeWidth={hoveredNode === fromNode.id || hoveredNode === toNode?.id ? '3' : '1'}
                        fill="none"
                        strokeDasharray={isHubConnection ? '5,5' : '3,3'}
                        initial={{ pathLength: 0 }}
                        animate={{ pathLength: 1 }}
                        transition={{ duration: 1, delay: index * 0.1 }}
                        className="transition-all duration-300"
                      />
                      {/* Data Flow Animation */}
                      <motion.circle
                        r={isHubConnection ? '3' : '2'}
                        fill={isHubConnection ? '#22D3EE' : '#A78BFA'}
                        filter="url(#glow)"
                        initial={{ offsetDistance: '0%' }}
                        animate={{ offsetDistance: '100%' }}
                        transition={{
                          duration: isHubConnection ? 3 : 5,
                          repeat: Infinity,
                          delay: index * 0.2,
                        }}
                        style={{
                          offsetPath: `path("${connection.path}")`,
                        }}
                      />
                    </g>
                  );
                });
              })()}
            </svg>

            {/* Nodes */}
            {clusterInfo.nodes.map((node, index) => {
              const positions = getNodePositions(clusterInfo.nodes.length);
              const pos = positions[index];

              return (
                <motion.div
                  key={node.id}
                  initial={{ scale: 0, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  transition={{ delay: index * 0.2 }}
                  className="absolute transform -translate-x-1/2 -translate-y-1/2 w-48"
                  style={{ left: `${pos.x}%`, top: `${pos.y}%` }}
                  onMouseEnter={() => setHoveredNode(node.id)}
                  onMouseLeave={() => setHoveredNode(null)}
                  onClick={() => {
                    const details = getNodeDetails(node);
                    setSelectedNodeDetails({ ...node, details });
                  }}
                >
                  <motion.div
                    whileHover={{ scale: 1.05 }}
                    className={`bg-black/60 backdrop-blur-xl border ${
                      hoveredNode === node.id ? 'border-cyan-400' : 'border-white/10'
                    } rounded-lg p-4 transition-all cursor-pointer`}
                  >
                    <div className="flex items-center gap-2 mb-2">
                      <motion.div
                        animate={{
                          scale: hoveredNode === node.id ? [1, 1.2, 1] : 1,
                        }}
                        transition={{ repeat: hoveredNode === node.id ? Infinity : 0, duration: 1 }}
                        className={`w-2 h-2 rounded-full ${node.status === 'active' ? 'bg-emerald-400' : 'bg-red-400'}`}
                      />
                      <span className="text-sm font-medium text-white">{node.type}</span>
                    </div>
                    <div className="text-xs text-gray-400">{node.gpu.name}</div>
                    <div className="mt-2 text-sm font-bold bg-gradient-to-r from-cyan-400 to-violet-400 bg-clip-text text-transparent">
                      {node.gpu.tflops.toFixed(1)} TFLOPS
                    </div>
                    <div className="mt-1 h-1 bg-black/40 rounded-full overflow-hidden">
                      <motion.div
                        initial={{ width: 0 }}
                        animate={{ width: `${node.gpu.utilization[1] * 100}%` }}
                        className="h-full bg-gradient-to-r from-cyan-500 to-violet-500"
                      />
                    </div>
                  </motion.div>
                </motion.div>
              );
            })}

            {/* Central Hub Label */}
            <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 text-center">
              <div className="text-xs text-cyan-400 font-medium">Hub</div>
              <div className="text-[10px] text-gray-400">Val-X Cluster</div>
            </div>
          </motion.div>

          {/* Actions */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3 }}
            className="flex justify-end gap-4"
          >
            <button
              onClick={() => setShowConfigModal(true)}
              className="px-6 py-3 rounded-lg bg-gradient-to-r from-cyan-500 to-violet-500 hover:from-cyan-400 hover:to-violet-400 text-white font-medium transition-all duration-200 flex items-center gap-2"
            >
              {isExecuting && <div className="i-ph:circle-notch-duotone animate-spin" />}
              Configure Cluster
            </button>
          </motion.div>
        </div>
      </div>

      {/* Configuration Modal */}
      <DialogRoot open={showConfigModal}>
        <Dialog
          onClose={() => setShowConfigModal(false)}
          className="bg-gradient-to-br from-[#22D3EE]/10 via-[#A78BFA]/10 to-[#E879F9]/10 max-w-4xl"
        >
          <DialogTitle className="relative border-b border-white/10 bg-black/20 backdrop-blur-sm">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-gradient-to-r from-[#22D3EE] to-[#A78BFA]">
                  <div className="i-ph:terminal-window-duotone text-xl text-white" />
                </div>
                <span>System Configuration</span>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setShowConfigModal(false)}
                  className="text-gray-400 hover:text-white transition-colors"
                >
                  <div className="i-ph:x-bold text-lg" />
                </button>
              </div>
            </div>
          </DialogTitle>
          <DialogDescription className="relative">
            <div className="space-y-6">
              {setupStep === 'init' ? (
                // Initial Setup Screen
                <div className="space-y-6">
                  <div className="text-center space-y-2">
                    <div className="text-xl font-bold text-white">Welcome to Val-X Setup</div>
                    <p className="text-gray-400">Let's get your system ready for Val-X</p>
                  </div>

                  <div className="p-4 bg-black/20 rounded-lg space-y-2">
                    <div className="text-sm font-medium text-[#22D3EE]">Detected System</div>
                    <div className="flex items-center gap-2">
                      <div
                        className={`i-ph:${osType === 'windows' ? 'windows-logo' : 'linux-logo'}-duotone text-2xl text-white`}
                      />
                      <span className="text-white capitalize">{osType} System</span>
                    </div>
                  </div>

                  <div className="space-y-2">
                    <div className="text-sm font-medium text-[#22D3EE]">Setup Process</div>
                    <div className="p-4 bg-black/20 rounded-lg space-y-3">
                      <div className="flex items-center gap-2">
                        <div className="i-ph:check-circle-duotone text-emerald-400" />
                        <span className="text-white">Gain terminal access</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <div className="i-ph:check-circle-duotone text-emerald-400" />
                        <span className="text-white">Install prerequisites</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <div className="i-ph:check-circle-duotone text-emerald-400" />
                        <span className="text-white">Configure Val-X</span>
                      </div>
                    </div>
                  </div>

                  <div className="flex justify-end">
                    <button
                      onClick={() => setSetupStep('prerequisites')}
                      className="px-4 py-2 rounded-lg bg-gradient-to-r from-cyan-500 to-violet-500 text-white hover:from-cyan-400 hover:to-violet-400 transition-colors"
                    >
                      Start Setup
                    </button>
                  </div>
                </div>
              ) : setupStep === 'prerequisites' ? (
                // Prerequisites Installation Screen
                <div className="space-y-6">
                  <div className="text-center space-y-2">
                    <div className="text-xl font-bold text-white">Installing Prerequisites</div>
                    <p className="text-gray-400">Running setup script for your system</p>
                  </div>

                  <div className="bg-black/60 rounded-lg border border-white/10 h-64 overflow-auto font-mono text-sm p-4">
                    {terminalLines.map((line, index) => (
                      <div
                        key={`${line.timestamp}-${index}`}
                        className={`${
                          line.type === 'error'
                            ? 'text-red-400'
                            : line.type === 'input'
                              ? 'text-cyan-400'
                              : 'text-gray-300'
                        }`}
                      >
                        {line.content}
                      </div>
                    ))}
                    {isExecuting && <div className="text-yellow-400 animate-pulse">Installing...</div>}
                  </div>

                  <div className="flex justify-end gap-2">
                    <button
                      onClick={requestElevatedPrivileges}
                      disabled={isExecuting || setupStatus.hasTerminalAccess}
                      className="px-4 py-2 rounded-lg border border-white/10 bg-black/20 text-white hover:bg-black/40 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      Request Privileges
                    </button>
                    <button
                      onClick={runSetupScript}
                      disabled={isExecuting || !setupStatus.hasTerminalAccess}
                      className="px-4 py-2 rounded-lg bg-gradient-to-r from-cyan-500 to-violet-500 text-white hover:from-cyan-400 hover:to-violet-400 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      {isExecuting ? (
                        <>
                          <div className="i-ph:circle-notch-duotone animate-spin mr-2" />
                          Installing...
                        </>
                      ) : (
                        'Install Prerequisites'
                      )}
                    </button>
                  </div>
                </div>
              ) : (
                // Terminal Access Screen (your existing terminal UI)
                <>
                  {/* Terminal Section */}
                  <div className="space-y-3">
                    <h3 className="text-sm font-medium text-[#22D3EE] flex items-center gap-2">
                      <div className="i-ph:terminal-duotone" />
                      System Terminal
                    </h3>
                    <div className="bg-black/60 rounded-lg border border-white/10 overflow-hidden">
                      {/* Terminal Output */}
                      <div className="h-64 overflow-auto font-mono text-sm p-4">
                        {terminalLines.map((line, index) => (
                          <div
                            key={`${line.timestamp}-${index}`}
                            className={`${
                              line.type === 'error'
                                ? 'text-red-400'
                                : line.type === 'input'
                                  ? 'text-cyan-400'
                                  : 'text-gray-300'
                            }`}
                          >
                            {line.content}
                          </div>
                        ))}
                        {isExecuting && <div className="text-yellow-400 animate-pulse">Processing...</div>}
                      </div>

                      {/* Command Input */}
                      <form
                        onSubmit={handleCommandSubmit}
                        className="flex items-center gap-2 p-2 border-t border-white/10 bg-black/40"
                      >
                        <span className="text-cyan-400">$</span>
                        <input
                          type="text"
                          value={commandInput}
                          onChange={(e) => setCommandInput(e.target.value)}
                          className="flex-1 bg-transparent border-none outline-none text-white font-mono text-sm"
                          placeholder="Enter command..."
                          disabled={isExecuting}
                        />
                        <button
                          type="submit"
                          disabled={isExecuting || !commandInput.trim()}
                          className="px-3 py-1 rounded bg-cyan-500/20 text-cyan-400 hover:bg-cyan-500/30 disabled:opacity-50 disabled:cursor-not-allowed text-sm transition-colors"
                        >
                          Run
                        </button>
                      </form>
                    </div>
                  </div>

                  {/* Quick Actions */}
                  <div className="space-y-3">
                    <h3 className="text-sm font-medium text-[#22D3EE]">Quick Actions</h3>
                    <div className="grid grid-cols-2 gap-3">
                      <button
                        onClick={() => executeCommand('python3 --version')}
                        className="p-3 bg-black/20 rounded-lg text-left hover:bg-black/40 transition-colors"
                      >
                        <div className="text-xs text-gray-400">Check Python Version</div>
                        <div className="text-sm text-white">python3 --version</div>
                      </button>
                      <button
                        onClick={() => executeCommand('nvidia-smi')}
                        className="p-3 bg-black/20 rounded-lg text-left hover:bg-black/40 transition-colors"
                      >
                        <div className="text-xs text-gray-400">Check NVIDIA GPU</div>
                        <div className="text-sm text-white">nvidia-smi</div>
                      </button>
                      <button
                        onClick={() => executeCommand('nvcc --version')}
                        className="p-3 bg-black/20 rounded-lg text-left hover:bg-black/40 transition-colors"
                      >
                        <div className="text-xs text-gray-400">Check CUDA Version</div>
                        <div className="text-sm text-white">nvcc --version</div>
                      </button>
                      <button
                        onClick={() => executeCommand('git --version')}
                        className="p-3 bg-black/20 rounded-lg text-left hover:bg-black/40 transition-colors"
                      >
                        <div className="text-xs text-gray-400">Check Git Version</div>
                        <div className="text-sm text-white">git --version</div>
                      </button>
                    </div>
                  </div>
                </>
              )}
            </div>
          </DialogDescription>
        </Dialog>
      </DialogRoot>

      {/* Node Details Modal */}
      <DialogRoot open={!!selectedNodeDetails}>
        <Dialog
          onClose={() => setSelectedNodeDetails(null)}
          className="bg-gradient-to-br from-[#22D3EE]/10 via-[#A78BFA]/10 to-[#E879F9]/10 max-w-2xl"
        >
          <DialogTitle className="relative border-b border-white/10 bg-black/20 backdrop-blur-sm">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-gradient-to-r from-[#22D3EE] to-[#A78BFA]">
                  <div className="i-ph:cpu-duotone text-xl text-white" />
                </div>
                <div>
                  <span className="text-lg">Node Details</span>
                  <div className="text-sm text-gray-400">{selectedNodeDetails?.type}</div>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <div
                  className={`px-2 py-1 rounded-full text-xs ${
                    selectedNodeDetails?.status === 'active'
                      ? 'bg-emerald-400/10 text-emerald-400'
                      : 'bg-red-400/10 text-red-400'
                  }`}
                >
                  {selectedNodeDetails?.status}
                </div>
                <button
                  onClick={() => setSelectedNodeDetails(null)}
                  className="text-gray-400 hover:text-white transition-colors"
                >
                  <div className="i-ph:x-bold text-lg" />
                </button>
              </div>
            </div>
          </DialogTitle>
          <DialogDescription className="relative">
            {selectedNodeDetails && (
              <div className="space-y-6">
                {/* Quick Stats */}
                <div className="grid grid-cols-4 gap-3">
                  <div className="p-3 bg-black/20 rounded-lg text-center">
                    <div className="text-2xl font-bold bg-gradient-to-r from-cyan-400 to-violet-400 bg-clip-text text-transparent">
                      {selectedNodeDetails.gpu.tflops.toFixed(1)}
                    </div>
                    <div className="text-xs text-gray-400">TFLOPS</div>
                  </div>
                  <div className="p-3 bg-black/20 rounded-lg text-center">
                    <div className="text-2xl font-bold bg-gradient-to-r from-violet-400 to-fuchsia-400 bg-clip-text text-transparent">
                      {selectedNodeDetails.details.cpuUsage.toFixed(0)}%
                    </div>
                    <div className="text-xs text-gray-400">CPU Load</div>
                  </div>
                  <div className="p-3 bg-black/20 rounded-lg text-center">
                    <div className="text-2xl font-bold bg-gradient-to-r from-cyan-400 to-violet-400 bg-clip-text text-transparent">
                      {selectedNodeDetails.details.temperature.toFixed(0)}°
                    </div>
                    <div className="text-xs text-gray-400">Temperature</div>
                  </div>
                  <div className="p-3 bg-black/20 rounded-lg text-center">
                    <div className="text-2xl font-bold bg-gradient-to-r from-violet-400 to-fuchsia-400 bg-clip-text text-transparent">
                      {selectedNodeDetails.details.uptime}
                    </div>
                    <div className="text-xs text-gray-400">Uptime</div>
                  </div>
                </div>

                {/* Status Section */}
                <div className="flex items-center justify-between p-4 bg-black/20 rounded-lg">
                  <div className="flex items-center gap-2">
                    <div
                      className={`w-2 h-2 rounded-full ${
                        selectedNodeDetails.status === 'active' ? 'bg-emerald-400' : 'bg-red-400'
                      }`}
                    />
                    <span className="text-white capitalize">{selectedNodeDetails.status}</span>
                  </div>
                  <div className="text-sm text-gray-400">
                    Last seen: {new Date(selectedNodeDetails.details.lastSeen).toLocaleTimeString()}
                  </div>
                </div>

                {/* GPU Information */}
                <div className="space-y-3">
                  <h3 className="text-sm font-medium text-[#22D3EE]">GPU Information</h3>
                  <div className="grid grid-cols-2 gap-3">
                    <div className="p-3 bg-black/20 rounded-lg">
                      <div className="text-xs text-gray-400">Model</div>
                      <div className="text-white">{selectedNodeDetails.gpu.name}</div>
                    </div>
                    <div className="p-3 bg-black/20 rounded-lg">
                      <div className="text-xs text-gray-400">Performance</div>
                      <div className="text-white">{selectedNodeDetails.gpu.tflops.toFixed(1)} TFLOPS</div>
                    </div>
                  </div>
                  <div className="p-3 bg-black/20 rounded-lg space-y-2">
                    <div className="text-xs text-gray-400">Utilization</div>
                    <div className="h-2 bg-black/40 rounded-full overflow-hidden">
                      <motion.div
                        className="h-full bg-gradient-to-r from-cyan-500 to-violet-500"
                        initial={{ width: 0 }}
                        animate={{ width: `${selectedNodeDetails.gpu.utilization[1] * 100}%` }}
                      />
                    </div>
                    <div className="text-xs text-right text-gray-400">
                      {(selectedNodeDetails.gpu.utilization[1] * 100).toFixed(1)}%
                    </div>
                  </div>
                </div>

                {/* System Metrics */}
                <div className="space-y-3">
                  <h3 className="text-sm font-medium text-[#22D3EE]">System Metrics</h3>
                  <div className="grid grid-cols-2 gap-3">
                    <div className="p-3 bg-black/20 rounded-lg">
                      <div className="text-xs text-gray-400">CPU Usage</div>
                      <div className="text-white">{selectedNodeDetails.details.cpuUsage.toFixed(1)}%</div>
                    </div>
                    <div className="p-3 bg-black/20 rounded-lg">
                      <div className="text-xs text-gray-400">Memory</div>
                      <div className="text-white">
                        {selectedNodeDetails.details.memoryUsed.toFixed(1)} / {selectedNodeDetails.details.memoryTotal}{' '}
                        GB
                      </div>
                    </div>
                    <div className="p-3 bg-black/20 rounded-lg">
                      <div className="text-xs text-gray-400">Temperature</div>
                      <div className="text-white">{selectedNodeDetails.details.temperature.toFixed(1)}°C</div>
                    </div>
                    <div className="p-3 bg-black/20 rounded-lg">
                      <div className="text-xs text-gray-400">Uptime</div>
                      <div className="text-white">{selectedNodeDetails.details.uptime}</div>
                    </div>
                  </div>
                </div>

                {/* Storage */}
                <div className="space-y-3">
                  <h3 className="text-sm font-medium text-[#22D3EE]">Storage</h3>
                  <div className="p-3 bg-black/20 rounded-lg space-y-2">
                    <div className="flex justify-between text-sm">
                      <span className="text-gray-400">Used Space</span>
                      <span className="text-white">
                        {selectedNodeDetails.details.diskSpace.used.toFixed(1)} /{' '}
                        {selectedNodeDetails.details.diskSpace.total} GB
                      </span>
                    </div>
                    <div className="h-2 bg-black/40 rounded-full overflow-hidden">
                      <motion.div
                        className="h-full bg-gradient-to-r from-cyan-500 to-violet-500"
                        initial={{ width: 0 }}
                        animate={{
                          width: `${
                            (selectedNodeDetails.details.diskSpace.used / selectedNodeDetails.details.diskSpace.total) *
                            100
                          }%`,
                        }}
                      />
                    </div>
                  </div>
                </div>

                {/* Actions */}
                <div className="flex justify-end gap-2 pt-4 border-t border-white/10">
                  <button
                    onClick={() => {
                      // TODO: Implement restart
                      console.log('Restart node:', selectedNodeDetails.id);
                    }}
                    className="px-4 py-2 rounded-lg border border-white/10 bg-black/20 text-white hover:bg-black/40 transition-colors"
                  >
                    Restart Node
                  </button>
                  <button
                    onClick={() => {
                      // TODO: Implement configure
                      console.log('Configure node:', selectedNodeDetails.id);
                    }}
                    className="px-4 py-2 rounded-lg bg-gradient-to-r from-cyan-500 to-violet-500 text-white hover:from-cyan-400 hover:to-violet-400 transition-colors"
                  >
                    Configure
                  </button>
                </div>
              </div>
            )}
          </DialogDescription>
        </Dialog>
      </DialogRoot>
    </div>
  );
}
