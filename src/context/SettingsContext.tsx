import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { DEFAULT_LOGISTICS, fetchLogistics, type LogisticsSettings } from '@/services/settings';

interface SettingsContextValue {
  logistics: LogisticsSettings;
  /** Re-reads Firestore; call after the admin saves new settings. */
  refresh: () => Promise<void>;
}

const SettingsContext = createContext<SettingsContextValue | null>(null);

/**
 * Store-wide settings shared by the cart, checkout and /shipping page.
 * Starts from the bundled defaults so the first render never waits.
 */
export function SettingsProvider({ children }: { children: React.ReactNode }) {
  const [logistics, setLogistics] = useState<LogisticsSettings>(DEFAULT_LOGISTICS);

  const refresh = useCallback(async () => {
    setLogistics(await fetchLogistics());
  }, []);

  useEffect(() => {
    let active = true;
    void fetchLogistics().then((next) => {
      if (active) setLogistics(next);
    });
    return () => {
      active = false;
    };
  }, []);

  const value = useMemo(() => ({ logistics, refresh }), [logistics, refresh]);
  return <SettingsContext.Provider value={value}>{children}</SettingsContext.Provider>;
}

export function useSettings(): SettingsContextValue {
  const context = useContext(SettingsContext);
  if (!context) throw new Error('useSettings must be used within a SettingsProvider');
  return context;
}
