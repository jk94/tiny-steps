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
import { Toaster } from './components/ui';
import { ServiceWorkerUpdateBanner } from './pwa/ServiceWorkerUpdateBanner.tsx';
import './index.css';
import App from './App.tsx';

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
              {/* App-root, dismissible "new version available" prompt for
                  the registerType: 'prompt' service worker flow (see
                  ServiceWorkerUpdateBanner / ADR-0008). */}
              <ServiceWorkerUpdateBanner />
              {/* App-root toast host. Sonner needs no context provider —
                  mounting it once here is what makes `toast()` callable from
                  anywhere (see components/ui/Toaster.tsx). */}
              <Toaster />
              <App />
            </SyncQueueProvider>
          </RealtimeProvider>
        </AuthProvider>
      </BrowserRouter>
    </QueryClientProvider>
  </StrictMode>,
);
