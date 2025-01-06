import { useParams } from '@remix-run/react';
import { classNames } from '~/utils/classNames';
import * as Dialog from '@radix-ui/react-dialog';
import { type ChatHistoryItem } from '~/lib/persistence';
import WithTooltip from '~/components/ui/Tooltip';
import { useEditChatDescription } from '~/lib/hooks';
import { forwardRef, type ForwardedRef } from 'react';

interface HistoryItemProps {
  item: ChatHistoryItem;
  onDelete?: (event: React.UIEvent) => void;
  onDuplicate?: (id: string) => void;
  exportChat: (id?: string) => void;
}

export function HistoryItem({ item, onDelete, onDuplicate, exportChat }: HistoryItemProps) {
  const { id: urlId } = useParams();
  const isActiveChat = urlId === item.urlId;

  const { editing, handleChange, handleBlur, handleSubmit, handleKeyDown, currentDescription, toggleEditMode } =
    useEditChatDescription({
      initialDescription: item.description,
      customChatId: item.id,
      syncWithGlobalStore: isActiveChat,
    });

  const renderDescriptionForm = (
    <form onSubmit={handleSubmit} className="flex-1 flex items-center">
      <input
        type="text"
        className="flex-1 bg-white/5 text-bolt-elements-textPrimary rounded-lg px-3 py-1.5 mr-2 border border-bolt-elements-borderColor/50 focus:outline-none focus:ring-2 focus:ring-purple-500/20"
        autoFocus
        value={currentDescription}
        onChange={handleChange}
        onBlur={handleBlur}
        onKeyDown={handleKeyDown}
      />
      <button
        type="submit"
        className="i-ph:check scale-110 hover:text-cyan-500 transition-colors"
        onMouseDown={handleSubmit}
      />
    </form>
  );

  return (
    <div
      className={classNames(
        'group rounded-xl text-bolt-elements-textSecondary hover:text-bolt-elements-textPrimary hover:bg-white/5 overflow-hidden flex justify-between items-center px-3 py-2 transition-all duration-200',
        {
          '[&&]:text-bolt-elements-textPrimary bg-gradient-to-r from-cyan-500/10 via-purple-500/10 to-pink-500/10 border border-purple-500/20':
            isActiveChat,
        },
      )}
    >
      {editing ? (
        renderDescriptionForm
      ) : (
        <a href={`/chat/${item.urlId}`} className="flex w-full relative truncate block">
          <div className="flex items-center gap-2 w-full">
            <div className="h-1.5 w-1.5 rounded-full bg-gradient-to-r from-cyan-500 to-purple-500 opacity-0 group-hover:opacity-100 transition-opacity" />
            <span className="truncate">{currentDescription}</span>
          </div>
          <div
            className={classNames(
              'absolute right-0 z-1 top-0 bottom-0 bg-gradient-to-l from-bolt-elements-background-depth-2 group-hover:from-bolt-elements-background-depth-3 box-content pl-3 to-transparent w-10 flex justify-end group-hover:w-22 group-hover:from-99%',
              { 'from-bolt-elements-background-depth-3 w-10': isActiveChat },
            )}
          >
            <div className="flex items-center p-1 text-bolt-elements-textSecondary opacity-0 group-hover:opacity-100 transition-all duration-200 gap-1">
              <ChatActionButton
                toolTipContent="Export chat"
                icon="i-ph:download-simple"
                onClick={(event) => {
                  event.preventDefault();
                  exportChat(item.id);
                }}
              />
              {onDuplicate && (
                <ChatActionButton
                  toolTipContent="Duplicate chat"
                  icon="i-ph:copy"
                  onClick={() => onDuplicate?.(item.id)}
                />
              )}
              <ChatActionButton
                toolTipContent="Rename chat"
                icon="i-ph:pencil-fill"
                onClick={(event) => {
                  event.preventDefault();
                  toggleEditMode();
                }}
              />
              <Dialog.Trigger asChild>
                <ChatActionButton
                  toolTipContent="Delete chat"
                  icon="i-ph:trash"
                  className="[&&]:hover:text-red-500"
                  onClick={(event) => {
                    event.preventDefault();
                    onDelete?.(event);
                  }}
                />
              </Dialog.Trigger>
            </div>
          </div>
        </a>
      )}
    </div>
  );
}

const ChatActionButton = forwardRef(
  (
    {
      toolTipContent,
      icon,
      className,
      onClick,
    }: {
      toolTipContent: string;
      icon: string;
      className?: string;
      onClick: (event: React.MouseEvent<HTMLButtonElement, MouseEvent>) => void;
      btnTitle?: string;
    },
    ref: ForwardedRef<HTMLButtonElement>,
  ) => {
    return (
      <WithTooltip tooltip={toolTipContent}>
        <button
          ref={ref}
          type="button"
          className={`scale-110 hover:text-cyan-500 transition-colors ${icon} ${className ? className : ''}`}
          onClick={onClick}
        />
      </WithTooltip>
    );
  },
);
