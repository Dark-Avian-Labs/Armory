import { useState, useEffect, useCallback } from 'react';

import { apiFetch, readApiErrorMessage } from '../utils/api';

interface ApiState<T> {
  data: T | null;
  loading: boolean;
  error: string | null;
  refetch: () => void;
}

export function useApi<T>(url: string | null): ApiState<T> {
  const [data, setData] = useState<T | null>(null);
  const [loading, setLoading] = useState(() => Boolean(url));
  const [error, setError] = useState<string | null>(null);
  const [trigger, setTrigger] = useState(0);

  const refetch = useCallback(() => setTrigger((t) => t + 1), []);

  useEffect(() => {
    if (!url) {
      setData(null);
      setLoading(false);
      return undefined;
    }

    const controller = new AbortController();
    setLoading(true);
    setError(null);

    apiFetch(url, { signal: controller.signal, cache: 'no-store' })
      .then(async (res) => {
        if (!res.ok) {
          throw new Error(await readApiErrorMessage(res, `Request failed (${res.status})`));
        }
        return res.json();
      })
      .then((json) => {
        setData(json);
        setLoading(false);
        return undefined;
      })
      .catch((err) => {
        if (err instanceof DOMException && err.name === 'AbortError') return;
        setData(null);
        setError(err.message);
        setLoading(false);
      });

    return () => {
      controller.abort();
    };
  }, [url, trigger]);

  return { data, loading, error, refetch };
}
