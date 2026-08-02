import { useContext } from 'react';
import { RealtimeContext, type RealtimeContextValue } from './RealtimeContext';

export function useRealtimeConnection(): RealtimeContextValue {
  const context = useContext(RealtimeContext);
  if (context === undefined) {
    throw new Error('useRealtimeConnection must be used within a RealtimeProvider');
  }
  return context;
}
