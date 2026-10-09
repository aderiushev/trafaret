import { useEffect, useState } from 'react';

/** The current time in epoch ms, refreshed every `intervalMs` while `active`. */
export function useNow(active: boolean, intervalMs = 250): number {
  const [now, setNow] = useState(Date.now);
  useEffect(() => {
    if (!active) return;
    const timer = setInterval(() => setNow(Date.now()), intervalMs);
    return () => clearInterval(timer);
  }, [active, intervalMs]);
  return now;
}
