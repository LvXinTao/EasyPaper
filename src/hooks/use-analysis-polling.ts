'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import type { PaperStatus } from '@/types';

const POLL_INTERVAL_MS = 2000;
const STALE_THRESHOLD_MS = 10 * 60 * 1000; // 10 minutes

interface PollingState {
  isPolling: boolean;
  analysisStep: string | null;
  analysisMessage: string | null;
  isStale: boolean;
  completedStatus: 'analyzed' | 'error' | null;
}

export function useAnalysisPolling(paperId: string, initialStatus: PaperStatus | null) {
  const [state, setState] = useState<PollingState>({
    isPolling: false,
    analysisStep: null,
    analysisMessage: null,
    isStale: false,
    completedStatus: null,
  });

  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const activeRef = useRef(false);

  const stopPolling = useCallback(() => {
    activeRef.current = false;
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
    setState(prev => ({ ...prev, isPolling: false }));
  }, []);

  const poll = useCallback(async () => {
    if (!activeRef.current) return;

    try {
      const res = await fetch(`/api/paper/${paperId}/status`);
      if (!res.ok || !activeRef.current) return;

      const data = await res.json();
      const { status, analysisProgress } = data as {
        status: PaperStatus;
        analysisProgress: { step: string; message: string; updatedAt: string } | null;
      };

      // Check if analysis completed
      if (status === 'analyzed' || status === 'error') {
        stopPolling();
        setState(prev => ({
          ...prev,
          isPolling: false,
          analysisStep: null,
          analysisMessage: null,
          isStale: false,
          completedStatus: status,
        }));
        return;
      }

      // Check for stale progress
      let isStale = false;
      if (analysisProgress?.updatedAt) {
        const age = Date.now() - new Date(analysisProgress.updatedAt).getTime();
        isStale = age > STALE_THRESHOLD_MS;
      }

      if (isStale) {
        stopPolling();
        setState(prev => ({
          ...prev,
          isPolling: false,
          isStale: true,
          analysisStep: analysisProgress?.step ?? null,
          analysisMessage: 'Analysis appears to be stuck. Try re-analyzing.',
          completedStatus: null,
        }));
        return;
      }

      // Update progress
      setState(prev => ({
        ...prev,
        analysisStep: analysisProgress?.step ?? null,
        analysisMessage: analysisProgress?.message ?? null,
        isStale: false,
        completedStatus: null,
      }));
    } catch {
      // Ignore fetch errors, will retry on next poll
    }
  }, [paperId, stopPolling]);

  const startPolling = useCallback(() => {
    if (activeRef.current) return;
    activeRef.current = true;
    setState(prev => ({
      ...prev,
      isPolling: true,
      isStale: false,
      completedStatus: null,
    }));
    // Poll immediately, then on interval
    poll();
    intervalRef.current = setInterval(poll, POLL_INTERVAL_MS);
  }, [poll]);

  // Auto-start polling when status indicates analysis is in progress
  useEffect(() => {
    if ((initialStatus === 'parsing' || initialStatus === 'analyzing') && !activeRef.current) {
      startPolling();
    }
  }, [initialStatus, startPolling]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      activeRef.current = false;
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
    };
  }, []);

  return {
    isPolling: state.isPolling,
    analysisStep: state.analysisStep,
    analysisMessage: state.analysisMessage,
    isStale: state.isStale,
    completedStatus: state.completedStatus,
    startPolling,
    stopPolling,
  };
}
