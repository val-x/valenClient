import { json } from '@remix-run/cloudflare';
import { useLoaderData } from '@remix-run/react';
import { chatStore } from '~/lib/stores/chat';
import { motion } from 'framer-motion';

interface ChatHistoryItem {
  id: string;
  title: string;
  timestamp: string;
  messages: number;
  lastMessage: string;
}

export async function loader() {
  // TODO: Load chat history from your persistence layer
  const mockHistory: ChatHistoryItem[] = [
    {
      id: '1',
      title: 'Code Review Discussion',
      timestamp: new Date().toISOString(),
      messages: 24,
      lastMessage: 'Here are the suggested improvements for your code...',
    },
  ];

  return json({
    chats: mockHistory,
  });
}

export default function Projects() {
  const { chats } = useLoaderData<typeof loader>();

  const handleChatSelect = (chatId: string) => {
    // TODO: Load chat into chatStore
    console.log('chatId', chatId);
    chatStore.setKey('started', true);
  };

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="max-w-4xl mx-auto">
        <motion.h1
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className="text-3xl font-bold bg-gradient-to-r from-cyan-400 to-violet-400 bg-clip-text text-transparent mb-8"
        >
          Projects & Chat History
        </motion.h1>

        <div className="grid gap-4">
          {chats.length === 0 ? (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="text-center py-12 bg-black/20 rounded-lg border border-white/10"
            >
              <div className="i-ph:chat-dots-duotone text-4xl mx-auto mb-4 text-white/40" />
              <p className="text-white/60">No chat history yet. Start a new conversation to see it here!</p>
            </motion.div>
          ) : (
            chats.map((chat) => (
              <motion.div
                key={chat.id}
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                whileHover={{ scale: 1.01 }}
                className="p-4 rounded-lg border border-white/10 bg-black/20 backdrop-blur-sm hover:bg-black/30 transition-colors cursor-pointer"
                onClick={() => handleChatSelect(chat.id)}
              >
                <div className="flex justify-between items-start mb-2">
                  <h3 className="font-medium text-white">{chat.title}</h3>
                  <span className="text-sm text-white/60">{new Date(chat.timestamp).toLocaleDateString()}</span>
                </div>
                <div className="flex items-center gap-2 text-sm text-white/60">
                  <div className="i-ph:chat-circle-dots" />
                  {chat.messages} messages
                </div>
                <p className="mt-2 text-sm text-white/80 line-clamp-2">{chat.lastMessage}</p>
              </motion.div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
