import { useCallback, useEffect, useState } from 'react';

interface AsyncState<T> {
  data: T | undefined;
  error: string;
  loading: boolean;
}

/** Firebase errors surfaced to staff in plain language. */
export function adminErrorMessage(error: unknown): string {
  const code = (error as { code?: string })?.code ?? '';
  if (code === 'permission-denied') {
    return 'Permission denied. Your account does not have the role this action needs — or the security rules have not been deployed.';
  }
  if (code === 'failed-precondition') {
    return 'A database index is still building. Wait a few minutes and retry.';
  }
  if (code === 'unavailable') return 'Firestore is unreachable. Check your connection.';
  return error instanceof Error ? error.message : 'Something went wrong.';
}

/**
 * Loads data once per `key`, with a `reload()` for after mutations.
 *
 * `loading` is only true until the first result: reloading keeps showing the
 * previous data rather than flashing a spinner over a table staff are using.
 */
export function useAsync<T>(loader: () => Promise<T>, key: string) {
  const [state, setState] = useState<AsyncState<T>>({ data: undefined, error: '', loading: true });
  const [nonce, setNonce] = useState(0);

  useEffect(() => {
    let active = true;
    loader()
      .then((data) => {
        if (active) setState({ data, error: '', loading: false });
      })
      .catch((error: unknown) => {
        console.error(`Load failed (${key}):`, error);
        if (active) setState((previous) => ({ ...previous, error: adminErrorMessage(error), loading: false }));
      });
    return () => {
      active = false;
    };
    // `loader` is re-created every render; `key` and `nonce` are what decide
    // whether a fetch is needed.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key, nonce]);

  const reload = useCallback(() => setNonce((n) => n + 1), []);

  return { ...state, reload };
}
