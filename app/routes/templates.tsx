import { json, type MetaFunction } from '@remix-run/cloudflare';
import { motion } from 'framer-motion';
import { Header } from '~/components/header/Header';
import BackgroundRays from '~/components/ui/BackgroundRays';
import { STARTER_TEMPLATES } from '~/utils/constants';
import type { Template } from '~/types/template';

export const meta: MetaFunction = () => {
  return [
    { title: 'VAL-X Templates' },
    { name: 'description', content: 'Start a new project with your favorite stack' },
  ];
};

export const loader = () => json({});

export default function Templates() {
  return (
    <div className="min-h-screen bg-bolt-elements-background-depth-1">
      <BackgroundRays />
      <Header />
      <div className="pt-24 flex flex-col items-center min-h-screen">
        <div className="max-w-4xl w-full px-6 py-12">
          <motion.h1
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="text-4xl md:text-5xl font-bold text-center bg-clip-text text-transparent bg-gradient-to-r from-cyan-400 via-violet-400 to-fuchsia-400"
          >
            Start with Your Favorite Stack
          </motion.h1>
          <motion.p
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            className="text-center text-gray-400 mt-4 mb-12"
          >
            Choose from our collection of starter templates to kickstart your next project
          </motion.p>
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
            className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-6"
          >
            {STARTER_TEMPLATES.map((template: Template, i) => (
              <motion.a
                key={template.name}
                href={`/git?url=https://github.com/${template.githubRepo}.git`}
                data-state="closed"
                data-discover="true"
                className="flex flex-col items-center justify-center p-6 rounded-xl bg-black/20 hover:bg-black/30 border border-white/10 transition-all duration-300 group"
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ delay: i * 0.05 }}
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
              >
                <div
                  className={`${template.icon} w-12 h-12 mb-3 opacity-50 group-hover:opacity-100 transition-opacity`}
                />
                <span className="text-sm text-gray-400 group-hover:text-white transition-colors">{template.label}</span>
                {template.description && (
                  <p className="mt-2 text-xs text-gray-500 text-center">{template.description}</p>
                )}
                {template.tags && template.tags.length > 0 && (
                  <div className="mt-3 flex flex-wrap gap-1 justify-center">
                    {template.tags.map((tag) => (
                      <span key={tag} className="px-2 py-0.5 text-[10px] rounded-full bg-white/5 text-gray-400">
                        {tag}
                      </span>
                    ))}
                  </div>
                )}
              </motion.a>
            ))}
          </motion.div>
        </div>
      </div>
    </div>
  );
}
