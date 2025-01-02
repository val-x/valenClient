import { useStore } from '@nanostores/react';
import { ClientOnly } from 'remix-utils/client-only';
import { chatStore } from '~/lib/stores/chat';
import { classNames } from '~/utils/classNames';
import { HeaderActionButtons } from './HeaderActionButtons.client';
import { ChatDescription } from '~/lib/persistence/ChatDescription.client';
import { motion, AnimatePresence } from 'framer-motion';
import { Link } from '@remix-run/react';
import { useState, useEffect, useRef } from 'react';
import { SiSupabase } from 'react-icons/si';
import Cookies from 'js-cookie';
import ChatAlert from '~/components/chat/ChatAlert';
import { toast } from 'react-toastify';

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

interface SupabaseOrgResponse {
  id: string;
  name: string;
  billing_email: string;
  created_at: string;
}

export function Header() {
  const chat = useStore(chatStore);
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [isScrolled, setIsScrolled] = useState(false);
  const [showSupabaseAlert, setShowSupabaseAlert] = useState(false);
  const [showSupabasePopover, setShowSupabasePopover] = useState(false);
  const [showProjectsPopover, setShowProjectsPopover] = useState(false);
  const [organizations, setOrganizations] = useState<SupabaseOrg[]>([]);
  const [selectedOrg, setSelectedOrg] = useState<SupabaseOrg | null>(null);
  const [isLoadingOrgs, setIsLoadingOrgs] = useState(false);
  const [showAccessTokenInput, setShowAccessTokenInput] = useState(false);
  const [accessToken, setAccessToken] = useState(Cookies.get('supabaseAccessToken') || '');
  const [isVerifyingToken, setIsVerifyingToken] = useState(false);
  const supabaseButtonRef = useRef<HTMLButtonElement>(null);
  const orgButtonRef = useRef<HTMLDivElement>(null);
  const popoverRef = useRef<HTMLDivElement>(null);
  const projectsPopoverRef = useRef<HTMLDivElement>(null);

  // Function to verify and save access token
  const handleSaveAccessToken = async () => {
    if (!accessToken.trim()) {
      toast.error('Please enter a valid access token');
      return;
    }

    setIsVerifyingToken(true);

    try {
      // Test the token by making a request to the organizations endpoint
      const response = await fetch('https://api.supabase.com/v1/organizations', {
        method: 'GET',
        headers: {
          Authorization: `Bearer ${accessToken}`,
          apikey: accessToken,
        },
      });

      if (!response.ok) {
        throw new Error(`Failed to verify token: ${response.statusText}`);
      }

      // If successful, save the token
      Cookies.set('supabaseAccessToken', accessToken, { expires: 30 }); // Token expires in 30 days
      setShowAccessTokenInput(false);
      toast.success('Access token verified and saved successfully');

      // Fetch organizations with the new token
      await fetchOrganizations();
    } catch (error) {
      console.error('Error verifying access token:', error);
      toast.error('Invalid access token. Please check and try again.');
      Cookies.remove('supabaseAccessToken'); // Remove invalid token
    } finally {
      setIsVerifyingToken(false);
    }
  };

  // Function to fetch organizations from Supabase
  const fetchOrganizations = async () => {
    setIsLoadingOrgs(true);

    try {
      const supabaseAccessToken = Cookies.get('supabaseAccessToken');

      if (!supabaseAccessToken) {
        throw new Error('Supabase access token not found');
      }

      // Fetch organizations directly
      const orgsResponse = await fetch('https://api.supabase.com/v1/organizations', {
        method: 'GET',
        headers: {
          Authorization: `Bearer ${supabaseAccessToken}`,
          apikey: supabaseAccessToken,
        },
      });

      if (!orgsResponse.ok) {
        throw new Error('Failed to fetch organizations');
      }

      const orgsData = (await orgsResponse.json()) as SupabaseOrgResponse[];
      const orgs = orgsData.map((org) => ({
        id: org.id,
        name: org.name,
        billing_email: org.billing_email,
        created_at: org.created_at,
      }));

      setOrganizations(orgs);

      // If there's a previously selected org, restore it
      const savedOrgId = Cookies.get('supabaseOrgId');

      if (savedOrgId) {
        const savedOrg = orgs.find((org) => org.id === savedOrgId);

        if (savedOrg) {
          setSelectedOrg(savedOrg);
        }
      }
    } catch (error) {
      console.error('Error fetching organizations:', error);
      toast.error('Failed to fetch organizations. Please check your Supabase access token.');
      setShowAccessTokenInput(true); // Show token input if fetch fails
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
      const activeProjects = allProjects.filter((p: SupabaseProject) => p.status === 'active_healthy');
      const inactiveProjects = allProjects.filter((p: SupabaseProject) => p.status !== 'active_healthy');

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

    // Fetch projects for the selected organization
    await fetchProjects(org.id);
  };

  useEffect(() => {
    const supabaseUrl = Cookies.get('supabaseUrl');
    const supabaseKey = Cookies.get('supabaseKey');
    const supabaseAccessToken = Cookies.get('supabaseAccessToken');

    if (!supabaseUrl || !supabaseKey) {
      setShowSupabaseAlert(true);
    }

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

  const navItems = [
    { label: 'Home', path: 'https://www.val-x.in/' },
    { label: 'Templates', path: '/templates' },
    { label: 'Agents', path: '/agents' },
    { label: 'Learn', path: 'https://www.val-x.in/learn-with-us' },
  ];

  useEffect(() => {
    const handleScroll = () => {
      setIsScrolled(window.scrollY > 20);
    };
    window.addEventListener('scroll', handleScroll);

    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  return (
    <motion.header
      initial={{ y: 0 }}
      animate={{ y: 0 }}
      transition={{ type: 'spring', stiffness: 50 }}
      className={classNames(
        'fixed top-0 left-0 right-0 w-full z-50 transition-all duration-500',
        isScrolled ? 'bg-black/50 backdrop-blur-xl border-b border-white/10 py-3' : 'bg-black/30 backdrop-blur-sm py-4',
      )}
    >
      <nav className="relative flex justify-between items-center px-6 max-w-7xl mx-auto">
        {/* Logo */}
        <div className="flex items-center gap-1 md:gap-2 z-logo text-bolt-elements-textPrimary">
          <div className="i-ph:sidebar-simple-duotone text-lg md:text-xl" />
          <Link to="/" className="text-xl md:text-3xl font-bold group perspective">
            <motion.div className="relative inline-block" whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }}>
              <span className="bg-clip-text text-transparent bg-gradient-to-r from-cyan-400 via-violet-400 to-fuchsia-400 font-black tracking-tight">
                VAL-X
              </span>
              <motion.div className="absolute -inset-1 rounded-lg bg-gradient-to-r from-cyan-400/20 via-violet-400/20 to-fuchsia-400/20 blur-lg opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
            </motion.div>
          </Link>
        </div>

        {/* Desktop Menu - Hide when chat is active */}
        {!chat.started && (
          <div className="hidden md:flex items-center space-x-1">
            {navItems.map((item, i) => (
              <motion.div
                key={item.label}
                initial={{ opacity: 0, y: -20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.1 }}
              >
                <a
                  href={item.path}
                  className="relative px-4 py-2 rounded-full text-sm font-medium text-gray-400 transition-all duration-300 hover:text-white group"
                >
                  <span className="relative z-10">{item.label}</span>
                  <div className="absolute inset-0 bg-white/0 rounded-full hover:bg-white/5 transition-colors duration-300" />
                </a>
              </motion.div>
            ))}
            <motion.div whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }}>
              <a
                href="https://www.val-x.in/get-started"
                className="relative ml-4 px-6 py-2.5 rounded-full overflow-hidden group"
              >
                <div className="absolute inset-0 bg-gradient-to-r from-cyan-500 via-violet-500 to-fuchsia-500 opacity-100 group-hover:opacity-90 transition-opacity" />
                <div className="absolute inset-0 bg-gradient-to-r from-cyan-400 via-violet-400 to-fuchsia-400 opacity-0 group-hover:opacity-100 blur-xl transition-opacity" />
                <span className="relative z-10 text-sm font-medium text-white">Get Started</span>
              </a>
            </motion.div>
          </div>
        )}

        {/* Mobile Menu Button - Hide when chat is active */}
        {!chat.started && (
          <motion.button
            className="md:hidden relative z-10 p-2"
            onClick={() => setIsMenuOpen(!isMenuOpen)}
            whileTap={{ scale: 0.9 }}
          >
            <div className="w-6 h-5 flex flex-col justify-between">
              <motion.span
                animate={isMenuOpen ? { rotate: 45, y: 8 } : { rotate: 0, y: 0 }}
                className="block h-0.5 w-6 bg-gradient-to-r from-cyan-400 to-violet-400 rounded-full"
              />
              <motion.span
                animate={isMenuOpen ? { opacity: 0 } : { opacity: 1 }}
                className="block h-0.5 w-6 bg-gradient-to-r from-violet-400 to-fuchsia-400 rounded-full"
              />
              <motion.span
                animate={isMenuOpen ? { rotate: -45, y: -8 } : { rotate: 0, y: 0 }}
                className="block h-0.5 w-6 bg-gradient-to-r from-fuchsia-400 to-cyan-400 rounded-full"
              />
            </div>
          </motion.button>
        )}

        {/* Mobile Menu */}
        <AnimatePresence>
          {isMenuOpen && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              transition={{ duration: 0.3 }}
              className="absolute top-full left-0 w-full bg-black/90 backdrop-blur-xl border-t border-white/10 md:hidden"
            >
              <div className="flex flex-col p-6 space-y-4">
                {navItems.map((item, i) => (
                  <motion.div
                    key={item.label}
                    initial={{ opacity: 0, x: -20 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: i * 0.1 }}
                  >
                    <a
                      href={item.path}
                      className="block px-4 py-2 rounded-lg text-base font-medium text-gray-400 hover:text-white hover:bg-white/5 transition-colors"
                      onClick={() => setIsMenuOpen(false)}
                    >
                      {item.label}
                    </a>
                  </motion.div>
                ))}
                <motion.div
                  initial={{ opacity: 0, scale: 0.8 }}
                  animate={{ opacity: 1, scale: 1 }}
                  transition={{ delay: 0.3 }}
                >
                  <a
                    href="https://www.val-x.in/get-started"
                    className="block w-full text-center bg-gradient-to-r from-cyan-500 via-violet-500 to-fuchsia-500 text-white px-6 py-3 rounded-lg font-medium hover:opacity-90 transition-opacity"
                    onClick={() => setIsMenuOpen(false)}
                  >
                    Get Started
                  </a>
                </motion.div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Chat Description and Action Buttons */}
        {chat.started && (
          <div className="flex-1 flex items-center justify-between md:justify-end gap-4 ml-4">
            <span className="flex-1 md:flex-initial px-4 truncate text-center text-bolt-elements-textPrimary">
              <ClientOnly>{() => <ChatDescription />}</ClientOnly>
            </span>
            <div className="flex items-center gap-3">
              {showSupabaseAlert && (
                <div className="absolute top-20 left-1/2 transform -translate-x-1/2 w-full max-w-2xl z-50">
                  <ChatAlert
                    alert={{
                      type: 'error',
                      title: 'Connection Required',
                      description: 'Supabase connection is not configured',
                      content: 'Please configure your Supabase connection to continue',
                      source: 'preview',
                    }}
                    clearAlert={() => setShowSupabaseAlert(false)}
                    postMessage={(_message) => {
                      setShowSupabaseAlert(false);
                      setShowSupabasePopover(true);
                    }}
                  />
                </div>
              )}

              <motion.button
                ref={supabaseButtonRef}
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                className="relative px-4 py-2 rounded-full text-sm font-medium text-white overflow-hidden group"
                onMouseEnter={() => setShowSupabasePopover(true)}
              >
                <div className="absolute inset-0 bg-gradient-to-r from-cyan-500 via-violet-500 to-fuchsia-500 opacity-100 group-hover:opacity-90 transition-opacity" />
                <div className="absolute inset-0 bg-gradient-to-r from-cyan-400 via-violet-400 to-fuchsia-400 opacity-0 group-hover:opacity-100 blur-xl transition-opacity" />
                <span className="relative z-10 flex items-center gap-2">
                  <SiSupabase className="text-lg" />
                  Supabase
                  <span className="px-1.5 py-0.5 text-xs bg-white/10 rounded-full">Beta</span>
                </span>
              </motion.button>

              {/* Supabase Popover */}
              {showSupabasePopover && (
                <motion.div
                  ref={popoverRef}
                  initial={{ opacity: 0, y: -10 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="absolute right-0 mt-2 w-[90vw] sm:w-96 rounded-2xl bg-gradient-to-br from-black/80 via-black/90 to-black/95 border border-white/10 shadow-2xl z-50 backdrop-blur-2xl"
                  style={{ top: '100%' }}
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
                          <SiSupabase className="text-2xl text-white" />
                        </div>
                        <div>
                          <h2 className="text-xl font-bold bg-gradient-to-r from-cyan-400 via-violet-400 to-fuchsia-400 bg-clip-text text-transparent">
                            Supabase
                          </h2>
                          <p className="text-xs text-white/50">Database & Authentication</p>
                        </div>
                      </div>

                      {!Cookies.get('supabaseAccessToken') || showAccessTokenInput ? (
                        <div className="space-y-4">
                          <div className="p-4 rounded-xl bg-gradient-to-r from-white/5 to-transparent border border-white/10">
                            <h3 className="text-sm font-medium text-white/90 mb-2">Access Token Required</h3>
                            <p className="text-xs text-white/70 mb-4">
                              To connect with Supabase, please provide your access token. You can find this in your{' '}
                              <a
                                href="https://supabase.com/dashboard/account/tokens"
                                target="_blank"
                                rel="noopener noreferrer"
                                className="text-cyan-400 hover:text-cyan-300 transition-colors underline decoration-white/20 hover:decoration-cyan-300/50"
                              >
                                Supabase Dashboard
                              </a>
                              .
                            </p>
                            <div className="space-y-4">
                              <input
                                type="password"
                                value={accessToken}
                                onChange={(e) => setAccessToken(e.target.value)}
                                placeholder="Enter your access token"
                                className="w-full bg-black/50 text-white border border-white/10 rounded-lg px-4 py-2 focus:outline-none focus:border-cyan-500/50 placeholder-white/30"
                              />
                              <div className="flex gap-2">
                                <motion.button
                                  whileHover={{ scale: 1.02 }}
                                  onClick={handleSaveAccessToken}
                                  disabled={isVerifyingToken || !accessToken.trim()}
                                  className="flex-1 py-2 px-4 text-center text-white transition-colors rounded-lg bg-gradient-to-r from-cyan-500 to-violet-500 hover:from-cyan-400 hover:to-violet-400 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                                >
                                  {isVerifyingToken ? (
                                    <>
                                      <div className="i-ph:spinner animate-spin" />
                                      Verifying...
                                    </>
                                  ) : (
                                    <>
                                      <div className="i-ph:check-circle" />
                                      Save Token
                                    </>
                                  )}
                                </motion.button>
                                {Cookies.get('supabaseAccessToken') && (
                                  <motion.button
                                    whileHover={{ scale: 1.02 }}
                                    onClick={() => setShowAccessTokenInput(false)}
                                    className="px-4 py-2 text-white/70 hover:text-white transition-colors rounded-lg bg-white/5 hover:bg-white/10 border border-white/10"
                                  >
                                    Cancel
                                  </motion.button>
                                )}
                              </div>
                            </div>
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

                          <motion.div
                            ref={orgButtonRef}
                            whileHover={{ scale: 1.02 }}
                            className="flex items-center gap-3 p-4 rounded-xl bg-gradient-to-r from-white/5 to-transparent hover:from-white/10 hover:to-white/5 border border-white/10 cursor-pointer mb-4 group transition-all duration-300"
                            onMouseEnter={() => setShowProjectsPopover(true)}
                            onMouseLeave={(e) => {
                              const rect = projectsPopoverRef.current?.getBoundingClientRect();
                              if (rect) {
                                const isOverProjects =
                                  e.clientX >= rect.left &&
                                  e.clientX <= rect.right &&
                                  e.clientY >= rect.top &&
                                  e.clientY <= rect.bottom;
                                if (!isOverProjects) {
                                  setShowProjectsPopover(false);
                                }
                              }
                            }}
                          >
                            <div className="flex-1 min-w-0">
                              <span className="text-lg text-white group-hover:text-cyan-300 transition-colors truncate block">
                                {Cookies.get('supabaseOrgName') || 'Select Organization'}
                              </span>
                              <span className="text-xs text-white/50 group-hover:text-white/70 transition-colors">
                                {Cookies.get('supabaseOrgId')
                                  ? `ID: ${Cookies.get('supabaseOrgId')}`
                                  : 'No organization selected'}
                              </span>
                            </div>
                            <div className="shrink-0 w-8 h-8 rounded-lg bg-gradient-to-br from-cyan-500/20 via-violet-500/20 to-fuchsia-500/20 flex items-center justify-center border border-white/10">
                              <span className="text-white/70 group-hover:text-cyan-300 transition-colors">›</span>
                            </div>
                          </motion.div>
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
                        </>
                      )}
                    </div>
                  </div>
                </motion.div>
              )}

              {/* Projects Popover */}
              {showProjectsPopover && (
                <motion.div
                  ref={projectsPopoverRef}
                  initial={{ opacity: 0, x: -10 }}
                  animate={{ opacity: 1, x: 0 }}
                  className="fixed w-[90vw] sm:w-96 rounded-2xl bg-gradient-to-br from-black/80 via-black/90 to-black/95 border border-white/10 shadow-2xl z-50 backdrop-blur-2xl"
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
                    </div>
                  </div>
                </motion.div>
              )}

              <motion.button
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                className="relative px-4 py-2 rounded-full text-sm font-medium text-white overflow-hidden group"
                onClick={() => {
                  /* TODO: Implement publish */
                }}
              >
                <div className="absolute inset-0 bg-gradient-to-r from-cyan-500 via-violet-500 to-fuchsia-500 opacity-100 group-hover:opacity-90 transition-opacity" />
                <div className="absolute inset-0 bg-gradient-to-r from-cyan-400 via-violet-400 to-fuchsia-400 opacity-0 group-hover:opacity-100 blur-xl transition-opacity" />
                <span className="relative z-10 flex items-center gap-2">
                  <div className="i-ph:rocket-launch text-lg" />
                  Publish
                  <span className="px-1.5 py-0.5 text-xs bg-white/10 rounded-full">Beta</span>
                </span>
              </motion.button>
              <ClientOnly>
                {() => (
                  <div className="mr-1">
                    <HeaderActionButtons />
                  </div>
                )}
              </ClientOnly>
            </div>
          </div>
        )}
      </nav>
    </motion.header>
  );
}
