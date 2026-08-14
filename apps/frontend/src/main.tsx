import './i18n'; // must run before first render — initializes the singleton
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter } from 'react-router';
import { QueryClientProvider } from '@tanstack/react-query';
import { AuthProvider } from './auth/AuthProvider.tsx';
import { queryClient } from './lib/query-client.ts';
import { RealtimeProvider } from './realtime/RealtimeProvider.tsx';
import { SyncQueueProvider } from './offline/SyncQueueProvider.tsx';
import { ConflictNoticeBanner } from './components/ConflictNoticeBanner.tsx';
import { registerServiceWorker } from './pwa/registerServiceWorker.ts';
import './index.css';
import App from './App.tsx';

// Called once at module scope (not from a React useEffect) so it runs
// exactly once per page load regardless of StrictMode's double-invocation
// of effects — see the function's own doc comment.
registerServiceWorker();

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <AuthProvider>
          {/* Inside AuthProvider: RealtimeProvider needs useAuth() to know
              when to open/close the WebSocket connection (see its own doc
              comment). */}
          <RealtimeProvider>
            {/* Inside RealtimeProvider: SyncQueueProvider drains the offline
                queue off the socket's connectivity state (see its doc
                comment). */}
            <SyncQueueProvider>
              {/* App-root, non-blocking Last-Write-Wins conflict notices
                  (see ConflictNoticeBanner / ADR-0011). */}
              <ConflictNoticeBanner />
              <App />
            </SyncQueueProvider>
          </RealtimeProvider>
        </AuthProvider>
      </BrowserRouter>
    </QueryClientProvider>
  </StrictMode>,
);
