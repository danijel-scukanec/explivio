import NetInfo from '@react-native-community/netinfo';
import { useEffect, useState } from 'react';
import { syncQueue } from './api';
import { queueCount } from './offline';

// F31: tracks connectivity and the pending-mutation count. When the device comes back online it
// replays the queued mutations (syncQueue) and refreshes the count.
export function useOnline(): { online: boolean; pending: number } {
  const [online, setOnline] = useState(true);
  const [pending, setPending] = useState(0);

  useEffect(() => {
    let mounted = true;
    const refresh = () => queueCount().then(n => { if (mounted) setPending(n); });
    refresh();

    const unsub = NetInfo.addEventListener(state => {
      const isOnline = state.isConnected !== false;
      if (mounted) setOnline(isOnline);
      if (isOnline) {
        syncQueue().then(refresh).catch(refresh);
      } else {
        refresh();
      }
    });

    return () => { mounted = false; unsub(); };
  }, []);

  return { online, pending };
}
