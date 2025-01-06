import { useStore } from '@nanostores/react';
import useViewport from '~/lib/hooks';
import { chatStore } from '~/lib/stores/chat';
import { workbenchStore } from '~/lib/stores/workbench';
import { classNames } from '~/utils/classNames';
import { motion } from 'framer-motion';
import { useState } from 'react';
import { Dialog, DialogButton, DialogDescription, DialogRoot, DialogTitle } from '~/components/ui/Dialog';

interface HeaderActionButtonsProps {}

export function HeaderActionButtons({}: HeaderActionButtonsProps) {
  const showWorkbench = useStore(workbenchStore.showWorkbench);
  const { showChat } = useStore(chatStore);
  const [showClusterModal, setShowClusterModal] = useState(false);
  const [clusterPercentage, setClusterPercentage] = useState(30);

  // Mock data - replace with actual data from your cluster service
  const clusterStats = {
    totalConnected: 156,
    seeders: 89,
    leechers: 67,
  };

  const isSmallViewport = useViewport(1024);

  const canHideChat = showWorkbench || !showChat;

  const sliderSteps = [30, 40, 50, 60, 70, 80];

  return (
    <div className="flex items-center gap-2">
      <motion.div
        className="flex items-center gap-1 p-1 rounded-lg bg-gradient-to-r from-cyan-500/20 via-violet-500/20 to-fuchsia-500/20 border border-white/10 backdrop-blur-sm"
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.2 }}
      >
        <Button
          active={showChat}
          disabled={!canHideChat || isSmallViewport}
          onClick={() => {
            if (canHideChat) {
              chatStore.setKey('showChat', !showChat);
            }
          }}
        >
          <div className="i-bolt:chat text-sm" />
          <span className="ml-1.5">Chat</span>
        </Button>
        <div className="w-[1px] h-5 bg-white/10" />
        <Button
          active={showWorkbench}
          onClick={() => {
            if (showWorkbench && !showChat) {
              chatStore.setKey('showChat', true);
            }

            workbenchStore.showWorkbench.set(!showWorkbench);
          }}
        >
          <div className="i-ph:code-bold" />
          <span className="ml-1.5">Code</span>
        </Button>
        {!isSmallViewport && (
          <>
            <div className="w-[1px] h-5 bg-white/10" />
            <Button onClick={() => setShowClusterModal(true)}>
              <div className="i-ph:plug-bold" />
              <span className="ml-1.5">Connect to Cluster</span>
            </Button>
          </>
        )}
      </motion.div>

      <DialogRoot open={showClusterModal}>
        <Dialog
          onClose={() => setShowClusterModal(false)}
          className="bg-gradient-to-br from-[#22D3EE]/10 via-[#A78BFA]/10 to-[#E879F9]/10"
        >
          <DialogTitle className="relative border-b border-white/10 bg-black/20 backdrop-blur-sm">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-gradient-to-r from-[#22D3EE] to-[#A78BFA]">
                <div className="i-ph:plug-duotone text-xl text-white" />
              </div>
              <span>Connect to Cluster</span>
            </div>
          </DialogTitle>
          <DialogDescription className="relative">
            <div className="space-y-6">
              {/* Cluster Stats Section */}
              <div className="space-y-3">
                <h3 className="text-sm font-medium text-[#22D3EE] flex items-center gap-2">
                  <div className="i-ph:users-duotone" />
                  Cluster Statistics
                </h3>
                <div className="grid grid-cols-3 gap-4">
                  <div className="p-4 rounded-lg border border-white/10 bg-black/20 backdrop-blur-sm text-center">
                    <div className="text-2xl font-bold bg-gradient-to-r from-cyan-400 to-violet-400 bg-clip-text text-transparent">
                      {clusterStats.totalConnected}
                    </div>
                    <div className="text-xs text-white/60 mt-1">Total Connected</div>
                  </div>
                  <div className="p-4 rounded-lg border border-white/10 bg-black/20 backdrop-blur-sm text-center">
                    <div className="text-2xl font-bold text-emerald-400">{clusterStats.seeders}</div>
                    <div className="text-xs text-white/60 mt-1">Seeders</div>
                  </div>
                  <div className="p-4 rounded-lg border border-white/10 bg-black/20 backdrop-blur-sm text-center">
                    <div className="text-2xl font-bold text-amber-400">{clusterStats.leechers}</div>
                    <div className="text-xs text-white/60 mt-1">Leechers</div>
                  </div>
                </div>
              </div>

              {/* Slider Section */}
              <div className="space-y-3">
                <h3 className="text-sm font-medium text-[#22D3EE] flex items-center gap-2">
                  <div className="i-ph:sliders-duotone" />
                  Cluster Capacity
                </h3>
                <div className="p-4 rounded-lg border border-white/10 bg-black/20 backdrop-blur-sm">
                  <div className="flex items-center justify-between gap-2">
                    {sliderSteps.map((step) => (
                      <motion.button
                        key={step}
                        whileHover={{ scale: 1.05 }}
                        whileTap={{ scale: 0.95 }}
                        onClick={() => setClusterPercentage(step)}
                        className={classNames(
                          'relative px-3 py-2 rounded-lg transition-all duration-200',
                          step === clusterPercentage
                            ? 'bg-gradient-to-r from-cyan-500 to-violet-500 text-white shadow-lg shadow-cyan-500/20'
                            : 'bg-white/5 text-white/60 hover:bg-white/10 hover:text-white/80',
                        )}
                      >
                        {step}%
                      </motion.button>
                    ))}
                  </div>
                  <div className="mt-4 relative h-2 bg-white/5 rounded-full overflow-hidden">
                    <motion.div
                      className="absolute left-0 top-0 h-full bg-gradient-to-r from-cyan-500 to-violet-500"
                      initial={{ width: '0%' }}
                      animate={{ width: `${((clusterPercentage - 30) / 50) * 100}%` }}
                      transition={{ duration: 0.3 }}
                    />
                  </div>
                  <div className="mt-2 text-sm text-white/60">Selected capacity: {clusterPercentage}%</div>
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-4 border-t border-white/10">
                <DialogButton type="secondary" onClick={() => setShowClusterModal(false)}>
                  Cancel
                </DialogButton>
                <DialogButton
                  type="primary"
                  onClick={() => {
                    // Handle connection logic here
                    setShowClusterModal(false);
                  }}
                >
                  Connect
                </DialogButton>
              </div>
            </div>
          </DialogDescription>
        </Dialog>
      </DialogRoot>
    </div>
  );
}

interface ButtonProps {
  active?: boolean;
  disabled?: boolean;
  children?: any;
  onClick?: VoidFunction;
}

function Button({ active = false, disabled = false, children, onClick }: ButtonProps) {
  return (
    <motion.button
      whileHover={!disabled ? { scale: 1.02 } : undefined}
      whileTap={!disabled ? { scale: 0.98 } : undefined}
      className={classNames('flex items-center px-3 py-1.5 rounded-md transition-all duration-200', {
        'bg-gradient-to-r from-cyan-500 to-violet-500 hover:from-cyan-400 hover:to-violet-400 text-white shadow-lg shadow-cyan-500/20':
          !active && !disabled,
        'bg-gradient-to-r from-violet-500 to-fuchsia-500 hover:from-violet-400 hover:to-fuchsia-400 text-white shadow-lg shadow-violet-500/20':
          active && !disabled,
        'bg-transparent text-white/30 cursor-not-allowed': disabled,
      })}
      onClick={onClick}
    >
      <div
        className={classNames('flex items-center', {
          'text-white': !disabled,
          'text-white/30': disabled,
        })}
      >
        {children}
      </div>
    </motion.button>
  );
}
