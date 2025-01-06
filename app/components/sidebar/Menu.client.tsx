import { motion, type Variants } from 'framer-motion';
import { useCallback, useEffect, useRef, useState } from 'react';
import { toast } from 'react-toastify';
import { Dialog, DialogButton, DialogDescription, DialogRoot, DialogTitle } from '~/components/ui/Dialog';
import { ThemeSwitch } from '~/components/ui/ThemeSwitch';
import { SettingsWindow } from '~/components/settings/SettingsWindow';
import { SettingsButton } from '~/components/ui/SettingsButton';
import { db, deleteById, getAll, chatId, type ChatHistoryItem, useChatHistory } from '~/lib/persistence';
import { cubicEasingFn } from '~/utils/easings';
import { logger } from '~/utils/logger';
import { HistoryItem } from './HistoryItem';
import { binDates } from './date-binning';
import { useSearchFilter } from '~/lib/hooks/useSearchFilter';

const menuVariants = {
  closed: {
    opacity: 0,
    visibility: 'hidden',
    left: '-350px',
    transition: {
      duration: 0.3,
      ease: cubicEasingFn,
    },
  },
  open: {
    opacity: 1,
    visibility: 'initial',
    left: 0,
    transition: {
      duration: 0.3,
      ease: cubicEasingFn,
    },
  },
} satisfies Variants;

type DialogContent = { type: 'delete'; item: ChatHistoryItem } | null;

function CurrentDateTime() {
  const [dateTime, setDateTime] = useState(new Date());

  useEffect(() => {
    const timer = setInterval(() => {
      setDateTime(new Date());
    }, 60000);

    return () => clearInterval(timer);
  }, []);

  return (
    <div className="flex items-center gap-2 px-6 py-4 font-medium text-gray-700 dark:text-gray-200 border-b border-bolt-elements-borderColor bg-gradient-to-r from-cyan-500/10 via-purple-500/10 to-pink-500/10">
      <div className="h-4 w-4 i-ph:clock-thin text-cyan-500" />
      {dateTime.toLocaleDateString()} {dateTime.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
    </div>
  );
}

export const Menu = () => {
  const { duplicateCurrentChat, exportChat } = useChatHistory();
  const menuRef = useRef<HTMLDivElement>(null);
  const [list, setList] = useState<ChatHistoryItem[]>([]);
  const [open, setOpen] = useState(false);
  const [dialogContent, setDialogContent] = useState<DialogContent>(null);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);

  const { filteredItems: filteredList, handleSearchChange } = useSearchFilter({
    items: list,
    searchFields: ['description'],
  });

  const loadEntries = useCallback(() => {
    if (db) {
      getAll(db)
        .then((list) => list.filter((item) => item.urlId && item.description))
        .then(setList)
        .catch((error) => toast.error(error.message));
    }
  }, []);

  const deleteItem = useCallback((event: React.UIEvent, item: ChatHistoryItem) => {
    event.preventDefault();

    if (db) {
      deleteById(db, item.id)
        .then(() => {
          loadEntries();

          if (chatId.get() === item.id) {
            // hard page navigation to clear the stores
            window.location.pathname = '/';
          }
        })
        .catch((error) => {
          toast.error('Failed to delete conversation');
          logger.error(error);
        });
    }
  }, []);

  const closeDialog = () => {
    setDialogContent(null);
  };

  useEffect(() => {
    if (open) {
      loadEntries();
    }
  }, [open]);

  useEffect(() => {
    const enterThreshold = 40;
    const exitThreshold = 40;

    function onMouseMove(event: MouseEvent) {
      if (event.pageX < enterThreshold) {
        setOpen(true);
      }

      if (menuRef.current && event.clientX > menuRef.current.getBoundingClientRect().right + exitThreshold) {
        setOpen(false);
      }
    }

    window.addEventListener('mousemove', onMouseMove);

    return () => {
      window.removeEventListener('mousemove', onMouseMove);
    };
  }, []);

  const handleDeleteClick = (event: React.UIEvent, item: ChatHistoryItem) => {
    event.preventDefault();
    setDialogContent({ type: 'delete', item });
  };

  const handleDuplicate = async (id: string) => {
    await duplicateCurrentChat(id);
    loadEntries(); // Reload the list after duplication
  };

  return (
    <motion.div
      ref={menuRef}
      initial="closed"
      animate={open ? 'open' : 'closed'}
      variants={menuVariants}
      className="flex selection-accent flex-col side-menu fixed top-0 w-[350px] h-full bg-gradient-to-b from-bolt-elements-background-depth-2 to-bolt-elements-background-depth-3 border-r border-bolt-elements-borderColor z-sidebar shadow-2xl backdrop-blur-xl text-sm"
    >
      <div className="h-[60px] bg-gradient-to-r from-cyan-500/5 via-purple-500/5 to-pink-500/5" />
      <CurrentDateTime />
      <div className="flex-1 flex flex-col h-full w-full overflow-hidden">
        <div className="p-6 select-none space-y-4">
          <a
            href="/"
            className="flex gap-3 items-center bg-gradient-to-r from-cyan-500 via-purple-500 to-pink-500 text-white hover:shadow-lg hover:shadow-purple-500/20 rounded-xl p-3 transition-all duration-300 group"
          >
            <span className="inline-block i-bolt:chat scale-110 group-hover:rotate-12 transition-transform" />
            <span className="font-medium">Start new chat</span>
          </a>
          <div className="relative w-full">
            <div className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400">
              <div className="i-ph:magnifying-glass h-4 w-4" />
            </div>
            <input
              className="w-full bg-white/5 relative pl-10 pr-4 py-2.5 rounded-xl focus:outline-none focus:ring-2 focus:ring-purple-500/20 placeholder-bolt-elements-textTertiary text-bolt-elements-textPrimary dark:text-bolt-elements-textPrimary border border-bolt-elements-borderColor/50 transition-all duration-300"
              type="search"
              placeholder="Search chats..."
              onChange={handleSearchChange}
              aria-label="Search chats"
            />
          </div>
        </div>
        <div className="text-bolt-elements-textPrimary font-medium px-6 my-2 flex items-center gap-2">
          <div className="h-1 w-1 rounded-full bg-gradient-to-r from-cyan-500 to-purple-500" />
          Your Chats
        </div>
        <div className="flex-1 overflow-auto px-6 pb-5">
          {filteredList.length === 0 && (
            <div className="text-bolt-elements-textTertiary text-center py-8">
              {list.length === 0 ? 'No previous conversations' : 'No matches found'}
            </div>
          )}
          <DialogRoot open={dialogContent !== null}>
            {binDates(filteredList).map(({ category, items }) => (
              <div key={category} className="mt-4 first:mt-0 space-y-1.5">
                <div className="text-bolt-elements-textTertiary sticky top-0 z-1 bg-gradient-to-r from-bolt-elements-background-depth-2 to-bolt-elements-background-depth-3 pt-2 pb-1 font-medium text-xs uppercase tracking-wider">
                  {category}
                </div>
                {items.map((item) => (
                  <HistoryItem
                    key={item.id}
                    item={item}
                    exportChat={exportChat}
                    onDelete={(event) => handleDeleteClick(event, item)}
                    onDuplicate={() => handleDuplicate(item.id)}
                  />
                ))}
              </div>
            ))}
            <Dialog onBackdrop={closeDialog} onClose={closeDialog}>
              {dialogContent?.type === 'delete' && (
                <>
                  <DialogTitle>Delete Chat?</DialogTitle>
                  <DialogDescription asChild>
                    <div>
                      <p>
                        You are about to delete <strong>{dialogContent.item.description}</strong>.
                      </p>
                      <p className="mt-1">Are you sure you want to delete this chat?</p>
                    </div>
                  </DialogDescription>
                  <div className="px-5 pb-4 bg-bolt-elements-background-depth-2 flex gap-2 justify-end">
                    <DialogButton type="secondary" onClick={closeDialog}>
                      Cancel
                    </DialogButton>
                    <DialogButton
                      type="danger"
                      onClick={(event) => {
                        deleteItem(event, dialogContent.item);
                        closeDialog();
                      }}
                    >
                      Delete
                    </DialogButton>
                  </div>
                </>
              )}
            </Dialog>
          </DialogRoot>
        </div>
        <div className="flex items-center justify-between border-t border-bolt-elements-borderColor/50 p-6 bg-gradient-to-r from-cyan-500/5 via-purple-500/5 to-pink-500/5">
          <SettingsButton onClick={() => setIsSettingsOpen(true)} />
          <ThemeSwitch />
        </div>
      </div>
      <SettingsWindow open={isSettingsOpen} onClose={() => setIsSettingsOpen(false)} />
    </motion.div>
  );
};
