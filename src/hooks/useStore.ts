import { useState, useEffect, useCallback } from 'react';
import { v4 as uuidv4 } from 'uuid';
import type { TestSession, TestEntry, Finding, ChainData, AppState } from '../types';

const STORAGE_KEY = 'ai-pentest-store-v1';

const defaultState: AppState = {
  sessions: [],
  entries: [],
  findings: [],
  chains: [],
  activeSessionId: null,
  activeView: 'dashboard',
};

export function useStore() {
  const [state, setState] = useState<AppState>(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) {
        const parsed = JSON.parse(stored);
        return { ...defaultState, ...parsed };
      }
    } catch { /* ignore */ }
    return defaultState;
  });

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    } catch { /* ignore */ }
  }, [state]);

  const setView = useCallback((view: string) => {
    setState(s => ({ ...s, activeView: view }));
  }, []);

  const setActiveSession = useCallback((id: string | null) => {
    setState(s => ({ ...s, activeSessionId: id }));
  }, []);

  // ── Sessions ───────────────────────────────────────────────────────────────
  const createSession = useCallback((data: Omit<TestSession, 'id' | 'startedAt' | 'updatedAt'>) => {
    const session: TestSession = {
      ...data,
      id: uuidv4(),
      startedAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    setState(s => ({ ...s, sessions: [session, ...s.sessions], activeSessionId: session.id }));
    return session;
  }, []);

  const updateSession = useCallback((id: string, data: Partial<TestSession>) => {
    setState(s => ({
      ...s,
      sessions: s.sessions.map(sess =>
        sess.id === id ? { ...sess, ...data, updatedAt: new Date().toISOString() } : sess
      ),
    }));
  }, []);

  const deleteSession = useCallback((id: string) => {
    setState(s => ({
      ...s,
      sessions: s.sessions.filter(sess => sess.id !== id),
      entries: s.entries.filter(e => e.sessionId !== id),
      findings: s.findings.filter(f => f.sessionId !== id),
      activeSessionId: s.activeSessionId === id ? (s.sessions.find(ss => ss.id !== id)?.id ?? null) : s.activeSessionId,
    }));
  }, []);

  // ── Entries ────────────────────────────────────────────────────────────────
  const addEntry = useCallback((data: Omit<TestEntry, 'id' | 'timestamp'>) => {
    const entry: TestEntry = {
      ...data,
      id: uuidv4(),
      timestamp: new Date().toISOString(),
    };
    setState(s => ({
      ...s,
      entries: [entry, ...s.entries],
      sessions: s.sessions.map(sess =>
        sess.id === data.sessionId ? { ...sess, updatedAt: new Date().toISOString() } : sess
      ),
    }));
    return entry;
  }, []);

  const updateEntry = useCallback((id: string, data: Partial<TestEntry>) => {
    setState(s => ({
      ...s,
      entries: s.entries.map(e => e.id === id ? { ...e, ...data } : e),
    }));
  }, []);

  const deleteEntry = useCallback((id: string) => {
    setState(s => ({ ...s, entries: s.entries.filter(e => e.id !== id) }));
  }, []);

  // ── Findings ───────────────────────────────────────────────────────────────
  const addFinding = useCallback((data: Omit<Finding, 'id' | 'createdAt' | 'updatedAt'>) => {
    const finding: Finding = {
      ...data,
      id: uuidv4(),
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    setState(s => ({ ...s, findings: [finding, ...s.findings] }));
    return finding;
  }, []);

  const updateFinding = useCallback((id: string, data: Partial<Finding>) => {
    setState(s => ({
      ...s,
      findings: s.findings.map(f =>
        f.id === id ? { ...f, ...data, updatedAt: new Date().toISOString() } : f
      ),
    }));
  }, []);

  const deleteFinding = useCallback((id: string) => {
    setState(s => ({ ...s, findings: s.findings.filter(f => f.id !== id) }));
  }, []);

  // ── Chains ─────────────────────────────────────────────────────────────────
  const saveChain = useCallback((data: Omit<ChainData, 'id' | 'createdAt' | 'updatedAt'> & { id?: string }) => {
    if (data.id) {
      setState(s => ({
        ...s,
        chains: s.chains.map(c =>
          c.id === data.id ? { ...c, ...data, id: c.id, updatedAt: new Date().toISOString() } : c
        ),
      }));
      return data as ChainData;
    } else {
      const chain: ChainData = {
        ...data,
        id: uuidv4(),
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };
      setState(s => ({ ...s, chains: [chain, ...s.chains] }));
      return chain;
    }
  }, []);

  const deleteChain = useCallback((id: string) => {
    setState(s => ({ ...s, chains: s.chains.filter(c => c.id !== id) }));
  }, []);

  // ── Import / Export ────────────────────────────────────────────────────────
  const exportData = useCallback(() => {
    const blob = new Blob([JSON.stringify(state, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `ai-pentest-export-${new Date().toISOString().split('T')[0]}.json`;
    a.click();
    URL.revokeObjectURL(url);
  }, [state]);

  const importData = useCallback((json: string): boolean => {
    try {
      const parsed = JSON.parse(json);
      setState(s => ({ ...s, ...parsed }));
      return true;
    } catch {
      return false;
    }
  }, []);

  // ── Selectors ──────────────────────────────────────────────────────────────
  const activeSession = state.sessions.find(s => s.id === state.activeSessionId) ?? null;
  const sessionEntries = (sessionId: string) => state.entries.filter(e => e.sessionId === sessionId);
  const sessionFindings = (sessionId: string) => state.findings.filter(f => f.sessionId === sessionId);

  return {
    ...state,
    activeSession,
    sessionEntries,
    sessionFindings,
    setView,
    setActiveSession,
    createSession,
    updateSession,
    deleteSession,
    addEntry,
    updateEntry,
    deleteEntry,
    addFinding,
    updateFinding,
    deleteFinding,
    saveChain,
    deleteChain,
    exportData,
    importData,
  };
}

export type Store = ReturnType<typeof useStore>;
