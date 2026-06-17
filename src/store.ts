import { useRef, useState } from 'react';
import type { ScreenKey } from './types';

/**
 * App-shell state only. All domain data (enquiries, leads, tasks, calls,
 * customers, reports, settings) now lives in the backend and is fetched per
 * screen via the hooks in `src/api/*`.
 */
export function useAppStore() {
  const [screen, setScreen] = useState<ScreenKey>('overview');
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [selectedLeadId, setSelectedLeadId] = useState<string | null>(null);
  const [globalQuery, setGlobalQuery] = useState('');
  const [showAddLead, setShowAddLead] = useState(false);
  const [addError, setAddError] = useState(false);
  const [showNotif, setShowNotif] = useState(false);
  const [toast, setToast] = useState<string | null>(null);

  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  function showToastMsg(msg: string): void {
    if (toastTimer.current) clearTimeout(toastTimer.current);
    setToast(msg);
    toastTimer.current = setTimeout(() => setToast(null), 4200);
  }

  function goNav(target: ScreenKey): void {
    setScreen(target);
    setSelectedLeadId(null);
    setShowNotif(false);
  }

  function openLead(id: string): void {
    setSelectedLeadId(id);
    setShowNotif(false);
    setGlobalQuery('');
  }

  return {
    screen, sidebarCollapsed, selectedLeadId, globalQuery, showAddLead, addError, showNotif, toast,
    setSidebarCollapsed, setSelectedLeadId, setGlobalQuery, setShowAddLead, setAddError, setShowNotif, setToast,
    showToastMsg, goNav, openLead,
  };
}

export type AppStore = ReturnType<typeof useAppStore>;
