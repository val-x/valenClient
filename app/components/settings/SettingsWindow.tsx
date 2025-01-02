import * as RadixDialog from '@radix-ui/react-dialog';
import { motion } from 'framer-motion';
import { useState, type ReactElement } from 'react';
import { classNames } from '~/utils/classNames';
import { DialogTitle, dialogVariants, dialogBackdropVariants } from '~/components/ui/Dialog';
import styles from './Settings.module.scss';
import ProvidersTab from './providers/ProvidersTab';
import { useSettings } from '~/lib/hooks/useSettings';
import FeaturesTab from './features/FeaturesTab';
import DebugTab from './debug/DebugTab';
import EventLogsTab from './event-logs/EventLogsTab';
import ConnectionsTab from './connections/ConnectionsTab';
import DataTab from './data/DataTab';

interface SettingsProps {
  open: boolean;
  onClose: () => void;
}

type TabType = 'data' | 'providers' | 'features' | 'debug' | 'event-logs' | 'connection';

export const SettingsWindow = ({ open, onClose }: SettingsProps) => {
  const { debug, eventLogs } = useSettings();
  const [activeTab, setActiveTab] = useState<TabType>('data');

  const tabs: { id: TabType; label: string; icon: string; component?: ReactElement }[] = [
    { id: 'data', label: 'Data', icon: 'i-ph:database', component: <DataTab /> },
    { id: 'providers', label: 'Providers', icon: 'i-ph:key', component: <ProvidersTab /> },
    { id: 'connection', label: 'Connection', icon: 'i-ph:link', component: <ConnectionsTab /> },
    { id: 'features', label: 'Features', icon: 'i-ph:star', component: <FeaturesTab /> },
    ...(debug
      ? [
          {
            id: 'debug' as TabType,
            label: 'Debug Tab',
            icon: 'i-ph:bug',
            component: <DebugTab />,
          },
        ]
      : []),
    ...(eventLogs
      ? [
          {
            id: 'event-logs' as TabType,
            label: 'Event Logs',
            icon: 'i-ph:list-bullets',
            component: <EventLogsTab />,
          },
        ]
      : []),
  ];

  return (
    <RadixDialog.Root open={open}>
      <RadixDialog.Portal>
        <RadixDialog.Overlay asChild onClick={onClose}>
          <motion.div
            className="bg-black/30 fixed inset-0 z-max backdrop-blur-md"
            initial="closed"
            animate="open"
            exit="closed"
            variants={dialogBackdropVariants}
          />
        </RadixDialog.Overlay>
        <RadixDialog.Content aria-describedby={undefined} asChild>
          <motion.div
            className="fixed top-[50%] left-[50%] z-max h-[85vh] w-[90vw] max-w-[900px] translate-x-[-50%] translate-y-[-50%] border border-[#22D3EE]/20 rounded-2xl shadow-2xl focus:outline-none overflow-hidden bg-gradient-to-br from-[#22D3EE]/5 via-transparent to-[#A78BFA]/5"
            initial="closed"
            animate="open"
            exit="closed"
            variants={dialogVariants}
            style={{
              boxShadow: '0 8px 32px rgba(34, 211, 238, 0.1), 0 8px 32px rgba(167, 139, 250, 0.1)',
            }}
          >
            <div className="flex h-full">
              <div
                className={classNames(
                  'w-56 border-r border-[#22D3EE]/20 bg-gradient-to-b from-[#22D3EE]/5 via-transparent to-[#A78BFA]/5 p-6 flex flex-col justify-between backdrop-blur-sm',
                  styles['settings-tabs'],
                )}
              >
                <div>
                  <DialogTitle className="flex items-center gap-2 text-xl font-semibold mb-6">
                    <div className="i-ph:gear text-xl text-[#22D3EE]" />
                    <span className="bg-gradient-to-r from-[#22D3EE] to-[#A78BFA] bg-clip-text text-transparent">
                      Settings
                    </span>
                  </DialogTitle>
                  <motion.div className="space-y-2">
                    {tabs.map((tab) => (
                      <motion.button
                        key={tab.id}
                        onClick={() => setActiveTab(tab.id)}
                        className={classNames(activeTab === tab.id ? styles.active : '')}
                        whileHover={{ scale: 1.02 }}
                        whileTap={{ scale: 0.98 }}
                        transition={{ type: 'spring', stiffness: 400, damping: 17 }}
                      >
                        <div className={tab.icon} />
                        {tab.label}
                      </motion.button>
                    ))}
                  </motion.div>
                </div>
                <motion.div
                  className="mt-auto flex flex-col gap-3"
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.2 }}
                >
                  <motion.a
                    href="https://val-x.in/docs"
                    target="_blank"
                    rel="noopener noreferrer"
                    className={classNames(styles['settings-button'], 'flex items-center gap-2')}
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                  >
                    <div className="i-ph:book" />
                    Documentation
                  </motion.a>
                </motion.div>
              </div>

              <motion.div
                className="flex-1 flex flex-col p-8 pt-10 bg-gradient-to-br from-white/50 via-transparent to-transparent dark:from-black/50"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 0.1 }}
              >
                <motion.div
                  className={classNames('flex-1 overflow-y-auto custom-scrollbar', styles['selectable-text'])}
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ delay: 0.2 }}
                >
                  {tabs.find((tab) => tab.id === activeTab)?.component}
                </motion.div>
              </motion.div>
            </div>
            <RadixDialog.Close asChild onClick={onClose}>
              <motion.div
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                transition={{ type: 'spring', stiffness: 400, damping: 17 }}
                className="absolute top-[16px] right-[16px] w-8 h-8 flex items-center justify-center bg-gradient-to-r from-[#22D3EE] to-[#A78BFA] rounded-xl cursor-pointer"
              >
                <div className="i-ph:x text-xl text-white" />
              </motion.div>
            </RadixDialog.Close>
          </motion.div>
        </RadixDialog.Content>
      </RadixDialog.Portal>
    </RadixDialog.Root>
  );
};
