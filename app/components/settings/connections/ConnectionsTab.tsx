import { lazy, Suspense } from 'react';
import { GitHubConnectionCard } from '~/components/settings/connections/GitHubConnectionCard';

// Lazy load the MCPServersTab component
const McpServersTab = lazy(() => import('~/components/settings/mcp'));

export default function ConnectionsTab() {
  return (
    <div className="space-y-4">
      <div className="p-4 border border-bolt-elements-borderColor rounded-lg bg-bolt-elements-background-depth-3">
        <h3 className="text-lg font-medium text-bolt-elements-textPrimary mb-4">GitHub</h3>
        <GitHubConnectionCard />
      </div>

      <Suspense
        fallback={
          <div className="p-4 border border-bolt-elements-borderColor rounded-lg bg-bolt-elements-background-depth-3">
            <div className="animate-pulse flex space-x-4">
              <div className="flex-1 space-y-4 py-1">
                <div className="h-4 bg-bolt-elements-background-depth-1 rounded w-3/4" />
                <div className="space-y-2">
                  <div className="h-4 bg-bolt-elements-background-depth-1 rounded" />
                  <div className="h-4 bg-bolt-elements-background-depth-1 rounded w-5/6" />
                </div>
              </div>
            </div>
          </div>
        }
      >
        <McpServersTab />
      </Suspense>
    </div>
  );
}
