import { useCallback, useRef, useState, useEffect } from 'react';

interface QueryState<T> {
  data: T | null;
  loading: boolean;
  error: Error | null;
  lastFetch: number;
}

interface UseOptimizedQueryOptions {
  cacheTime?: number; // Cache duration in milliseconds
  staleTime?: number; // Time before data is considered stale
}

export function useOptimizedQuery<T>(
  queryKey: string,
  queryFn: () => Promise<T>,
  options: UseOptimizedQueryOptions = {}
) {
  const { cacheTime = 5 * 60 * 1000, staleTime = 30 * 1000 } = options; // 5min cache, 30sec stale
  
  const cache = useRef<Map<string, QueryState<T>>>(new Map());
  const [state, setState] = useState<QueryState<T>>(() => 
    cache.current.get(queryKey) || {
      data: null,
      loading: false,
      error: null,
      lastFetch: 0
    }
  );

  const execute = useCallback(async (force = false) => {
    const now = Date.now();
    const cached = cache.current.get(queryKey);
    
    // Return cached data if it's fresh enough and not forced
    if (!force && cached && (now - cached.lastFetch) < staleTime && !cached.loading) {
      if (cached !== state) {
        setState(cached);
      }
      return cached.data;
    }

    // Prevent multiple simultaneous requests for the same query
    if (cached?.loading) {
      return cached.data;
    }

    const newState: QueryState<T> = {
      data: cached?.data || null,
      loading: true,
      error: null,
      lastFetch: now
    };

    cache.current.set(queryKey, newState);
    setState(newState);

    try {
      const data = await queryFn();
      const finalState: QueryState<T> = {
        data,
        loading: false,
        error: null,
        lastFetch: now
      };
      
      cache.current.set(queryKey, finalState);
      setState(finalState);
      
      return data;
    } catch (error) {
      const errorState: QueryState<T> = {
        data: cached?.data || null,
        loading: false,
        error: error as Error,
        lastFetch: now
      };
      
      cache.current.set(queryKey, errorState);
      setState(errorState);
      
      throw error;
    }
  }, [queryKey, queryFn, staleTime, state]);

  // Cleanup old cache entries
  useEffect(() => {
    const cleanup = setInterval(() => {
      const now = Date.now();
      for (const [key, value] of cache.current.entries()) {
        if (now - value.lastFetch > cacheTime) {
          cache.current.delete(key);
        }
      }
    }, cacheTime);

    return () => clearInterval(cleanup);
  }, [cacheTime]);

  return {
    data: state.data,
    loading: state.loading,
    error: state.error,
    refetch: () => execute(true),
    execute: () => execute()
  };
}