'use client';

import { useState, useEffect, useCallback } from 'react';
import type { PaperData } from '@/types';

export function usePaper(paperId: string) {
  const [data, setData] = useState<PaperData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchPaper = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const response = await fetch(`/api/paper/${paperId}`);
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error?.message || 'Failed to load paper');
      }
      const paperData = await response.json();
      setData(paperData);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load paper');
    } finally {
      setLoading(false);
    }
  }, [paperId]);

  useEffect(() => {
    fetchPaper();
  }, [fetchPaper]);

  return { data, loading, error, refetch: fetchPaper };
}
