import { useCallback, useState } from 'react';

import { apiFetch, UnauthorizedError } from '../utils/api';

export function useBuildFavorites() {
  const [favoriteBusy, setFavoriteBusy] = useState(false);

  const addFavorite = useCallback(async (buildId: string): Promise<boolean> => {
    setFavoriteBusy(true);
    try {
      const response = await apiFetch(`/api/builds/${encodeURIComponent(buildId)}/favorite`, {
        method: 'POST',
      });
      return response.ok;
    } catch (error) {
      if (!(error instanceof UnauthorizedError)) {
        console.error('Failed to favorite build', error);
      }
      return false;
    } finally {
      setFavoriteBusy(false);
    }
  }, []);

  const removeFavorite = useCallback(async (buildId: string): Promise<boolean> => {
    setFavoriteBusy(true);
    try {
      const response = await apiFetch(`/api/builds/${encodeURIComponent(buildId)}/favorite`, {
        method: 'DELETE',
      });
      return response.ok;
    } catch (error) {
      if (!(error instanceof UnauthorizedError)) {
        console.error('Failed to unfavorite build', error);
      }
      return false;
    } finally {
      setFavoriteBusy(false);
    }
  }, []);

  const toggleFavorite = useCallback(
    async (buildId: string, currentlyFavorited: boolean): Promise<boolean> => {
      if (currentlyFavorited) {
        return removeFavorite(buildId);
      }
      return addFavorite(buildId);
    },
    [addFavorite, removeFavorite],
  );

  return {
    favoriteBusy,
    addFavorite,
    removeFavorite,
    toggleFavorite,
  };
}
