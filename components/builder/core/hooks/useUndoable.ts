import { useState, useCallback } from 'react';
import type { PlacedTile } from '@/types/builder';

type TilesState = Record<string, PlacedTile>;

const MAX_HISTORY = 50;

export function useUndoableTiles(initialState: TilesState) {
  const [past, setPast] = useState<TilesState[]>([]);
  const [present, setPresent] = useState<TilesState>(initialState);
  const [future, setFuture] = useState<TilesState[]>([]);

  const pushState = useCallback(
    (newState: TilesState | ((prev: TilesState) => TilesState)) => {
      setPresent((currentPresent) => {
        const resolved =
          typeof newState === 'function' ? newState(currentPresent) : newState;

        // Don't push if state hasn't changed
        if (resolved === currentPresent) return currentPresent;

        setPast((p) => [...p.slice(-(MAX_HISTORY - 1)), currentPresent]);
        setFuture([]);
        return resolved;
      });
    },
    []
  );

  const undo = useCallback(() => {
    setPast((currentPast) => {
      if (currentPast.length === 0) return currentPast;
      const previous = currentPast[currentPast.length - 1];
      const newPast = currentPast.slice(0, -1);

      setPresent((currentPresent) => {
        setFuture((f) => [currentPresent, ...f]);
        return previous;
      });

      return newPast;
    });
  }, []);

  const redo = useCallback(() => {
    setFuture((currentFuture) => {
      if (currentFuture.length === 0) return currentFuture;
      const next = currentFuture[0];
      const newFuture = currentFuture.slice(1);

      setPresent((currentPresent) => {
        setPast((p) => [...p, currentPresent]);
        return next;
      });

      return newFuture;
    });
  }, []);

  /** Reset to a new state, clearing all undo/redo history */
  const resetTo = useCallback((state: TilesState) => {
    setPresent(state);
    setPast([]);
    setFuture([]);
  }, []);

  return {
    tiles: present,
    setTiles: pushState,
    undo,
    redo,
    canUndo: past.length > 0,
    canRedo: future.length > 0,
    resetTo,
  };
}