import { json, type MetaFunction } from '@remix-run/cloudflare';
import { motion } from 'framer-motion';
import { Header } from '~/components/header/Header';
import BackgroundRays from '~/components/ui/BackgroundRays';
import { useState } from 'react';
import { AGENT_LIST, loadAgentConfig } from '~/utils/agents';
import { toast } from 'react-toastify';
import {
  SiPython,
  SiReact,
  SiYoutube,
  SiN8N,
  SiLinkedin,
  SiAutomattic,
  SiResearchgate,
  SiStackblitz,
} from 'react-icons/si';
import { FaTools, FaRobot, FaBrain, FaChartBar } from 'react-icons/fa';

export const meta: MetaFunction = () => {
  return [
    { title: 'VAL-X AI Agents' },
    { name: 'description', content: 'Explore cutting-edge AI agents curated and hosted by VAL-X' },
  ];
};

export const loader = () => json({});

const getCategoryIcon = (category: string) => {
  switch (category) {
    case 'Expert Systems':
      return <FaTools className="w-8 h-8" />;
    case 'Research & Analysis':
      return <SiResearchgate className="w-8 h-8" />;
    case 'Content Creation':
      return <SiLinkedin className="w-8 h-8" />;
    case 'Development':
      return <SiReact className="w-8 h-8" />;
    case 'Automation':
      return <SiAutomattic className="w-8 h-8" />;
    case 'Business':
      return <FaBrain className="w-8 h-8" />;
    case 'Technology':
      return <SiStackblitz className="w-8 h-8" />;
    case 'Content Analysis':
      return <FaChartBar className="w-8 h-8" />;
    default:
      return <FaRobot className="w-8 h-8" />;
  }
};

export default function Agents() {
  const [searchQuery, setSearchQuery] = useState('');
  const [sortBy, setSortBy] = useState('Date Added');
  const [loading, setLoading] = useState<string | null>(null);

  const handleViewDetails = async (githubPath: string, configFile: string) => {
    try {
      setLoading(githubPath);

      const config = await loadAgentConfig(githubPath, configFile);

      // TODO: Implement agent configuration handling
      console.log('Agent config loaded:', config);
      toast.success('Agent configuration loaded successfully!');
    } catch (error) {
      console.error('Failed to load agent:', error);
      toast.error('Failed to load agent configuration');
    } finally {
      setLoading(null);
    }
  };

  const filteredAgents = AGENT_LIST.filter(
    (agent) =>
      agent.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      agent.description.toLowerCase().includes(searchQuery.toLowerCase()) ||
      agent.category.toLowerCase().includes(searchQuery.toLowerCase()) ||
      agent.tags.some((tag) => tag.toLowerCase().includes(searchQuery.toLowerCase())),
  );

  return (
    <div className="min-h-screen bg-bolt-elements-background-depth-1">
      <BackgroundRays />
      <Header />
      <div className="pt-24 flex flex-col items-center min-h-screen">
        <div className="max-w-7xl w-full px-6 py-12">
          <motion.h1
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="text-4xl md:text-5xl font-bold text-center bg-clip-text text-transparent bg-gradient-to-r from-cyan-400 via-violet-400 to-fuchsia-400 mb-4"
          >
            Discover AI Agents
          </motion.h1>
          <motion.p
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            className="text-center text-gray-400 mb-12"
          >
            Explore cutting-edge AI agents curated and hosted by VAL-X, AND learn how to implement them yourself!
          </motion.p>

          <div className="flex flex-col md:flex-row gap-4 mb-8">
            <div className="flex-grow relative">
              <div className="absolute inset-y-0 left-3 flex items-center pointer-events-none">
                <div className="i-ph:magnifying-glass text-gray-400" />
              </div>
              <input
                type="text"
                placeholder="Search agents..."
                className="w-full pl-10 pr-4 py-2 bg-black/20 border border-white/10 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-violet-500"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
            </div>
            <div className="flex gap-4">
              <select
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value)}
                className="px-4 py-2 bg-black/20 border border-white/10 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-violet-500"
              >
                <option>Date Added</option>
                <option>Name</option>
                <option>Category</option>
              </select>
              <button className="px-4 py-2 bg-black/20 border border-white/10 rounded-lg text-white hover:bg-black/30 transition-colors flex items-center gap-2">
                <div className="i-ph:funnel text-lg" />
                Filters
              </button>
              <button
                className="px-4 py-2 bg-black/20 border border-white/10 rounded-lg text-white hover:bg-black/30 transition-colors"
                onClick={() => {
                  setSearchQuery('');
                  setSortBy('Date Added');
                }}
              >
                Reset All
              </button>
            </div>
          </div>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
            className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6"
          >
            {filteredAgents.map((agent, i) => (
              <motion.div
                key={agent.githubPath}
                className="group flex flex-col rounded-xl bg-gradient-to-br from-black/40 to-black/20 backdrop-blur-sm border border-white/5 overflow-hidden hover:border-violet-500/50 transition-all duration-300 hover:shadow-lg hover:shadow-violet-500/10"
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ delay: i * 0.05 }}
              >
                <div className="relative h-32 bg-gradient-to-br from-violet-500/10 via-fuchsia-500/10 to-cyan-500/10 p-6">
                  <div className="absolute inset-0 bg-gradient-to-br from-violet-500/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
                  <div className="relative z-10 flex items-center justify-between">
                    <div className="text-violet-400 group-hover:text-violet-300 transition-colors">
                      {getCategoryIcon(agent.category)}
                    </div>
                    <div className="flex gap-2">
                      {agent.tags.includes('Python') && <SiPython className="w-5 h-5 text-blue-400" />}
                      {agent.tags.includes('N8N') && <SiN8N className="w-5 h-5 text-red-400" />}
                      {agent.tags.includes('YouTube') && <SiYoutube className="w-5 h-5 text-red-500" />}
                    </div>
                  </div>
                </div>
                <div className="p-6 flex flex-col flex-grow">
                  <h3 className="text-lg font-semibold text-white mb-2 group-hover:text-violet-300 transition-colors">
                    {agent.name}
                  </h3>
                  <p className="text-sm text-gray-400 mb-2">{agent.category}</p>
                  <p className="text-sm text-gray-400 mb-4 flex-grow">{agent.description}</p>
                  <div className="flex flex-wrap gap-2 mb-4">
                    {agent.tags.map((tag) => (
                      <span
                        key={tag}
                        className="px-2 py-0.5 text-[10px] font-medium rounded-full text-white/90 bg-white/5 border border-white/10 hover:border-violet-500/30 transition-colors"
                      >
                        {tag}
                      </span>
                    ))}
                  </div>
                  <div className="flex items-center justify-between">
                    <button
                      className="px-4 py-2 bg-violet-600/80 hover:bg-violet-500 text-white text-sm rounded-lg transition-colors flex items-center gap-2 backdrop-blur-sm"
                      onClick={() => handleViewDetails(agent.githubPath, agent.configFile)}
                      disabled={loading === agent.githubPath}
                    >
                      {loading === agent.githubPath ? (
                        <>
                          <div className="i-svg-spinners:270-ring-with-bg animate-spin" />
                          Loading...
                        </>
                      ) : (
                        <>
                          <div className="i-ph:arrow-right" />
                          Try it out
                        </>
                      )}
                    </button>
                  </div>
                </div>
              </motion.div>
            ))}
          </motion.div>
        </div>
      </div>
    </div>
  );
}
