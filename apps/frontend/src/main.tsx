import './i18n'; // must run before first render — initializes the singleton
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter } from 'react-router';
import { QueryClientProvider } from '@tanstack/react-query';
import { AuthProvider } from './auth/AuthProvider.tsx';
import { queryClient } from './lib/query-client.ts';
import { RealtimeProvider } from './realtime/RealtimeProvider.tsx';
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
            <App />
          </RealtimeProvider>
        </AuthProvider>
      </BrowserRouter>
    </QueryClientProvider>
  </StrictMode>,
);
