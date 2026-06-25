import React, { useState } from 'react';
import {
  LayoutDashboard, FlaskConical, BookOpen, GitBranch,
  FileText, Shield, ChevronLeft, ChevronRight, Plus,
  Settings, Database, Menu, X, Terminal,
} from 'lucide-react';
import type { Store } from '../hooks/useStore';

interface LayoutProps {
  store: Store;
  children: React.ReactNode;
}

const NAV_ITEMS = [
  { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { id: 'sessions', label: 'Test Sessions', icon: Database },
  { id: 'promptlab', label: 'Prompt Lab', icon: FlaskConical },
  { id: 'interact', label: 'Direct Interaction', icon: Terminal },
  { id: 'library', label: 'Prompt Library', icon: BookOpen },
  { id: 'chain', label: 'Exploit Chain', icon: GitBranch },
  { id: 'reports', label: 'Reports', icon: FileText },
];

export default function Layout({ store, children }: LayoutProps) {
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);

  const activeSession = store.activeSession;

  return (
    <div className="flex h-screen overflow-hidden" style={{ background: '#08080f' }}>
      {/* Ambient glow blobs */}
      <div className="fixed inset-0 pointer-events-none overflow-hidden z-0" aria-hidden="true">
        <div
          className="absolute animate-blob"
          style={{
            top: '-15%', right: '-10%',
            width: '55vw', height: '55vw',
            background: 'radial-gradient(circle, rgba(0,212,255,0.065) 0%, transparent 65%)',
            borderRadius: '50%',
          }}
        />
        <div
          className="absolute animate-blob"
          style={{
            bottom: '-20%', left: '-10%',
            width: '50vw', height: '50vw',
            background: 'radial-gradient(circle, rgba(0,255,136,0.045) 0%, transparent 65%)',
            borderRadius: '50%',
            animationDelay: '3s',
          }}
        />
        <div
          className="absolute animate-blob"
          style={{
            top: '40%', left: '30%',
            width: '40vw', height: '40vw',
            background: 'radial-gradient(circle, rgba(199,125,255,0.03) 0%, transparent 65%)',
            borderRadius: '50%',
            animationDelay: '5.5s',
          }}
        />
      </div>

      {/* Mobile overlay */}
      {mobileOpen && (
        <div
          className="fixed inset-0 z-20 lg:hidden"
          style={{ background: 'rgba(0,0,0,0.65)', backdropFilter: 'blur(4px)' }}
          onClick={() => setMobileOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside
        className={`
          glass-sidebar flex flex-col
          transition-all duration-200 z-30
          ${collapsed ? 'w-16' : 'w-60'}
          fixed lg:relative h-full
          ${mobileOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'}
        `}
      >
        {/* Logo */}
        <div className={`flex items-center gap-3 p-4 min-h-[60px] ${collapsed ? 'justify-center' : ''}`}
             style={{ borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
          <div
            className="flex-shrink-0 w-8 h-8 rounded-lg flex items-center justify-center"
            style={{
              background: 'rgba(0,212,255,0.12)',
              border: '1px solid rgba(0,212,255,0.3)',
              boxShadow: '0 0 14px rgba(0,212,255,0.2)',
            }}
          >
            <Shield size={16} className="text-cyber-blue" />
          </div>
          {!collapsed && (
            <div className="min-w-0">
              <div className="text-sm font-bold text-cyber-text leading-tight">HexProbe</div>
              <div className="text-xs text-cyber-dim leading-tight">AI Red-Team</div>
            </div>
          )}
        </div>

        {/* Active session indicator */}
        {!collapsed && activeSession && (
          <div
            className="mx-3 mt-3 px-3 py-2 rounded-lg"
            style={{
              background: 'rgba(0,255,136,0.07)',
              border: '1px solid rgba(0,255,136,0.18)',
              boxShadow: '0 0 10px rgba(0,255,136,0.06)',
            }}
          >
            <div className="text-xs text-cyber-dim mb-0.5">Active Session</div>
            <div className="text-xs font-medium text-cyber-green truncate">{activeSession.name}</div>
            <div className="text-xs text-cyber-dim truncate">{activeSession.target}</div>
          </div>
        )}
        {collapsed && activeSession && (
          <div className="flex justify-center mt-3">
            <div className="w-2 h-2 rounded-full bg-cyber-green animate-pulse-slow glow-green" title={activeSession.name} />
          </div>
        )}

        {/* Nav */}
        <nav className="flex-1 p-2 space-y-0.5 overflow-y-auto mt-2">
          {NAV_ITEMS.map(({ id, label, icon: Icon }) => (
            <button
              key={id}
              onClick={() => { store.setView(id); setMobileOpen(false); }}
              className={`nav-item ${store.activeView === id ? 'nav-item-active' : ''} ${collapsed ? 'justify-center px-0' : ''}`}
              title={collapsed ? label : undefined}
            >
              <Icon size={18} className="flex-shrink-0" />
              {!collapsed && <span className="truncate">{label}</span>}
            </button>
          ))}
        </nav>

        {/* Quick Actions */}
        {!collapsed && (
          <div className="p-2 space-y-0.5" style={{ borderTop: '1px solid rgba(255,255,255,0.05)' }}>
            <button
              onClick={() => { store.setView('sessions'); setMobileOpen(false); }}
              className="nav-item w-full"
            >
              <Plus size={16} className="flex-shrink-0" />
              <span className="text-xs">New Session</span>
            </button>
            <button
              onClick={() => { store.setView('reports'); setMobileOpen(false); }}
              className="nav-item w-full"
            >
              <Settings size={16} className="flex-shrink-0" />
              <span className="text-xs">Settings & Export</span>
            </button>
          </div>
        )}

        {/* Collapse toggle */}
        <button
          onClick={() => setCollapsed(c => !c)}
          className="hidden lg:flex items-center justify-center p-3 text-cyber-dim hover:text-cyber-text transition-colors"
          style={{ borderTop: '1px solid rgba(255,255,255,0.05)' }}
        >
          {collapsed ? <ChevronRight size={16} /> : <ChevronLeft size={16} />}
        </button>
      </aside>

      {/* Main content */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden relative z-10">
        {/* Mobile header */}
        <header
          className="lg:hidden flex items-center gap-3 px-4 py-3"
          style={{
            background: 'rgba(8,8,18,0.88)',
            borderBottom: '1px solid rgba(255,255,255,0.06)',
            backdropFilter: 'blur(20px)',
            WebkitBackdropFilter: 'blur(20px)',
          }}
        >
          <button onClick={() => setMobileOpen(true)} className="text-cyber-dim hover:text-cyber-text">
            <Menu size={20} />
          </button>
          <Shield size={18} className="text-cyber-blue" />
          <span className="text-sm font-semibold text-cyber-text">HexProbe</span>
        </header>

        {/* Page content */}
        <main className="flex-1 overflow-auto">
          {children}
        </main>
      </div>
    </div>
  );
}
