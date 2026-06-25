import React from 'react';
import {
  AlertTriangle, CheckCircle, Activity, Shield, Target,
  TrendingUp, Clock, FlaskConical, BookOpen, GitBranch,
  ChevronRight, AlertCircle,
} from 'lucide-react';
import type { Store } from '../hooks/useStore';
import type { Severity } from '../types';

interface Props { store: Store }

const SEV_ORDER: Severity[] = ['critical', 'high', 'medium', 'low', 'info'];

const SEV_CONFIG: Record<Severity, { color: string; bg: string; border: string; label: string }> = {
  critical: { color: 'text-cyber-red', bg: 'bg-cyber-red', border: 'border-cyber-red', label: 'Critical' },
  high:     { color: 'text-cyber-orange', bg: 'bg-cyber-orange', border: 'border-cyber-orange', label: 'High' },
  medium:   { color: 'text-cyber-amber', bg: 'bg-cyber-amber', border: 'border-cyber-amber', label: 'Medium' },
  low:      { color: 'text-cyber-blue', bg: 'bg-cyber-blue', border: 'border-cyber-blue', label: 'Low' },
  info:     { color: 'text-cyber-dim', bg: 'bg-cyber-dim', border: 'border-cyber-dim', label: 'Info' },
};

function SeverityBar({ counts, total }: { counts: Record<Severity, number>; total: number }) {
  if (total === 0) return <div className="text-xs text-cyber-dim">No findings yet</div>;
  return (
    <div className="space-y-2">
      {SEV_ORDER.map(sev => {
        const count = counts[sev];
        if (count === 0) return null;
        const cfg = SEV_CONFIG[sev];
        const pct = Math.round((count / total) * 100);
        return (
          <div key={sev} className="flex items-center gap-2">
            <span className={`text-xs w-14 ${cfg.color}`}>{cfg.label}</span>
            <div className="flex-1 h-1.5 bg-cyber-muted rounded-full overflow-hidden">
              <div
                className={`h-full ${cfg.bg} bg-opacity-80 rounded-full transition-all`}
                style={{ width: `${pct}%` }}
              />
            </div>
            <span className="text-xs text-cyber-dim w-6 text-right">{count}</span>
          </div>
        );
      })}
    </div>
  );
}

function StatCard({ icon: Icon, label, value, sub, color = 'text-cyber-blue', glowColor }: {
  icon: React.ElementType; label: string; value: string | number; sub?: string; color?: string; glowColor?: string;
}) {
  return (
    <div className="card flex items-start gap-3">
      <div
        className={`mt-0.5 p-2 rounded-lg flex-shrink-0 ${color}`}
        style={glowColor ? {
          background: `${glowColor}12`,
          border: `1px solid ${glowColor}22`,
          boxShadow: `0 0 12px ${glowColor}18`,
        } : { background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.08)' }}
      >
        <Icon size={18} />
      </div>
      <div className="min-w-0">
        <div className="text-2xl font-bold text-cyber-text leading-tight">{value}</div>
        <div className="text-xs font-medium text-cyber-dim mt-0.5">{label}</div>
        {sub && <div className="text-xs text-cyber-dim/70 mt-0.5">{sub}</div>}
      </div>
    </div>
  );
}

export default function Dashboard({ store }: Props) {
  const { sessions, entries, findings, setView, setActiveSession } = store;

  const activeSessions = sessions.filter(s => s.status === 'active');
  const vulnerableEntries = entries.filter(e => e.outcome === 'vulnerable');
  const openFindings = findings.filter(f => f.status === 'open' || f.status === 'confirmed');

  const findingCounts = SEV_ORDER.reduce((acc, sev) => {
    acc[sev] = findings.filter(f => f.severity === sev).length;
    return acc;
  }, {} as Record<Severity, number>);

  const outcomeCounts = {
    vulnerable: entries.filter(e => e.outcome === 'vulnerable').length,
    partial: entries.filter(e => e.outcome === 'partial').length,
    notVulnerable: entries.filter(e => e.outcome === 'not-vulnerable').length,
    inconclusive: entries.filter(e => e.outcome === 'inconclusive').length,
  };

  const recentEntries = [...entries].sort((a, b) =>
    new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
  ).slice(0, 5);

  const categoryMap: Record<string, number> = {};
  entries.forEach(e => {
    categoryMap[e.category] = (categoryMap[e.category] || 0) + 1;
  });
  const topCategories = Object.entries(categoryMap)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5);

  const totalTests = entries.length;
  const vulnRate = totalTests > 0 ? Math.round((vulnerableEntries.length / totalTests) * 100) : 0;

  return (
    <div className="p-6 space-y-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-xl font-bold text-cyber-text flex items-center gap-2">
            <Shield size={22} className="text-cyber-blue" />
            AI Security Testing Dashboard
          </h1>
          <p className="text-sm text-cyber-dim mt-1">
            Overview of all test sessions, findings, and exploitation coverage.
          </p>
        </div>
        <div className="flex gap-2">
          <button onClick={() => setView('sessions')} className="btn-primary">
            <Target size={15} />
            New Session
          </button>
        </div>
      </div>

      {/* Empty state */}
      {sessions.length === 0 && (
        <div className="card text-center py-16">
          <Shield size={48} className="text-cyber-dim mx-auto mb-4 opacity-40" />
          <h2 className="text-lg font-semibold text-cyber-text mb-2">No Test Sessions Yet</h2>
          <p className="text-sm text-cyber-dim max-w-md mx-auto mb-6">
            Start by creating a test session for your target LLM application. Then use the Prompt Lab to log test interactions and document findings.
          </p>
          <div className="flex gap-3 justify-center flex-wrap">
            <button onClick={() => setView('sessions')} className="btn-primary">
              <Target size={15} /> Create First Session
            </button>
            <button onClick={() => setView('library')} className="btn-secondary">
              <BookOpen size={15} /> Browse Prompt Library
            </button>
          </div>
        </div>
      )}

      {sessions.length > 0 && (
        <>
          {/* Stats row */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <StatCard
              icon={Activity}
              label="Active Sessions"
              value={activeSessions.length}
              sub={`${sessions.length} total`}
              color="text-cyber-green"
              glowColor="#00ff88"
            />
            <StatCard
              icon={FlaskConical}
              label="Total Tests Run"
              value={totalTests}
              sub={`${vulnRate}% vuln rate`}
              color="text-cyber-blue"
              glowColor="#00d4ff"
            />
            <StatCard
              icon={AlertTriangle}
              label="Open Findings"
              value={openFindings.length}
              sub={`${findings.length} total`}
              color="text-cyber-red"
              glowColor="#ff4757"
            />
            <StatCard
              icon={AlertCircle}
              label="Vulnerable Tests"
              value={vulnerableEntries.length}
              sub={`${outcomeCounts.partial} partial`}
              color="text-cyber-orange"
              glowColor="#ff6b35"
            />
          </div>

          {/* Middle row */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
            {/* Findings by severity */}
            <div className="card">
              <div className="card-header flex items-center justify-between">
                <span>Findings by Severity</span>
                <span className="text-cyber-text normal-case text-sm font-semibold">{findings.length}</span>
              </div>
              <SeverityBar counts={findingCounts} total={findings.length} />
              {findings.length > 0 && (
                <button
                  onClick={() => setView('reports')}
                  className="mt-4 text-xs text-cyber-blue hover:underline flex items-center gap-1"
                >
                  View all findings <ChevronRight size={12} />
                </button>
              )}
            </div>

            {/* Test outcomes */}
            <div className="card">
              <div className="card-header">Test Outcomes</div>
              {totalTests === 0 ? (
                <div className="text-xs text-cyber-dim">No tests run yet</div>
              ) : (
                <div className="space-y-2">
                  {[
                    { label: 'Vulnerable', count: outcomeCounts.vulnerable, color: 'bg-cyber-red' },
                    { label: 'Partial', count: outcomeCounts.partial, color: 'bg-cyber-amber' },
                    { label: 'Not Vulnerable', count: outcomeCounts.notVulnerable, color: 'bg-cyber-green' },
                    { label: 'Inconclusive', count: outcomeCounts.inconclusive, color: 'bg-cyber-dim' },
                  ].map(({ label, count, color }) => (
                    <div key={label} className="flex items-center gap-2">
                      <span className="text-xs text-cyber-dim w-28">{label}</span>
                      <div className="flex-1 h-1.5 bg-cyber-muted rounded-full overflow-hidden">
                        <div
                          className={`h-full ${color} bg-opacity-80 rounded-full`}
                          style={{ width: `${totalTests > 0 ? (count / totalTests) * 100 : 0}%` }}
                        />
                      </div>
                      <span className="text-xs text-cyber-dim w-6 text-right">{count}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Top categories tested */}
            <div className="card">
              <div className="card-header">Top Categories Tested</div>
              {topCategories.length === 0 ? (
                <div className="text-xs text-cyber-dim">No tests run yet</div>
              ) : (
                <div className="space-y-2">
                  {topCategories.map(([cat, count]) => (
                    <div key={cat} className="flex items-center justify-between">
                      <span className="text-xs font-mono text-cyber-blue">{cat}</span>
                      <div className="flex items-center gap-2">
                        <div className="w-16 h-1 bg-cyber-muted rounded-full overflow-hidden">
                          <div
                            className="h-full bg-cyber-blue bg-opacity-70 rounded-full"
                            style={{ width: `${topCategories[0][1] > 0 ? (count / topCategories[0][1]) * 100 : 0}%` }}
                          />
                        </div>
                        <span className="text-xs text-cyber-dim w-4 text-right">{count}</span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Recent activity */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {/* Recent entries */}
            <div className="card">
              <div className="card-header flex items-center justify-between">
                <span>Recent Test Entries</span>
                <button onClick={() => setView('promptlab')} className="text-xs text-cyber-blue hover:underline flex items-center gap-1">
                  Go to Lab <ChevronRight size={12} />
                </button>
              </div>
              {recentEntries.length === 0 ? (
                <div className="text-xs text-cyber-dim py-4">No tests logged yet. Start in the Prompt Lab.</div>
              ) : (
                <div className="space-y-2">
                  {recentEntries.map(entry => {
                    const cfg = SEV_CONFIG[entry.severity];
                    return (
                      <div key={entry.id} className="flex items-start gap-3 p-2 rounded-lg transition-colors" style={{ transition: 'background 150ms ease' }} onMouseEnter={e => (e.currentTarget as HTMLDivElement).style.background = 'rgba(255,255,255,0.04)'} onMouseLeave={e => (e.currentTarget as HTMLDivElement).style.background = 'transparent'}>
                        <span className={`badge badge-${entry.outcome} mt-0.5 flex-shrink-0`}>
                          {entry.outcome === 'vulnerable' ? '⚠ VULN' :
                           entry.outcome === 'partial' ? '~ PART' :
                           entry.outcome === 'not-vulnerable' ? '✓ SAFE' : '? INC'}
                        </span>
                        <div className="min-w-0 flex-1">
                          <div className="text-xs font-medium text-cyber-text truncate">{entry.title}</div>
                          <div className="text-xs text-cyber-dim truncate">{entry.categoryName} · {new Date(entry.timestamp).toLocaleDateString()}</div>
                        </div>
                        <span className={`badge badge-${entry.severity} flex-shrink-0`}>{cfg.label}</span>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Active sessions */}
            <div className="card">
              <div className="card-header flex items-center justify-between">
                <span>Active Sessions</span>
                <button onClick={() => setView('sessions')} className="text-xs text-cyber-blue hover:underline flex items-center gap-1">
                  All Sessions <ChevronRight size={12} />
                </button>
              </div>
              {activeSessions.length === 0 ? (
                <div className="text-xs text-cyber-dim py-4">No active sessions. Create one to start testing.</div>
              ) : (
                <div className="space-y-2">
                  {activeSessions.slice(0, 5).map(sess => {
                    const sessEntries = entries.filter(e => e.sessionId === sess.id);
                    const vulns = sessEntries.filter(e => e.outcome === 'vulnerable').length;
                    const sessFindings = findings.filter(f => f.sessionId === sess.id);
                    const critical = sessFindings.filter(f => f.severity === 'critical').length;
                    return (
                      <div
                        key={sess.id}
                        className="flex items-start gap-3 p-2 rounded-lg cursor-pointer"
                        style={{ transition: 'background 150ms ease' }}
                        onMouseEnter={e => (e.currentTarget as HTMLDivElement).style.background = 'rgba(255,255,255,0.04)'}
                        onMouseLeave={e => (e.currentTarget as HTMLDivElement).style.background = 'transparent'}
                        onClick={() => { setActiveSession(sess.id); setView('promptlab'); }}
                      >
                        <div className="w-2 h-2 rounded-full bg-cyber-green mt-1.5 flex-shrink-0 animate-pulse-slow" />
                        <div className="min-w-0 flex-1">
                          <div className="text-xs font-medium text-cyber-text truncate">{sess.name}</div>
                          <div className="text-xs text-cyber-dim truncate">{sess.target}</div>
                        </div>
                        <div className="text-right flex-shrink-0">
                          <div className="text-xs text-cyber-text">{sessEntries.length} tests</div>
                          {critical > 0 && (
                            <div className="text-xs text-cyber-red">{critical} critical</div>
                          )}
                          {vulns > 0 && critical === 0 && (
                            <div className="text-xs text-cyber-orange">{vulns} vulns</div>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>

          {/* Quick links */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {[
              { view: 'promptlab', icon: FlaskConical, label: 'Prompt Lab', desc: 'Log & test prompts', accent: 'rgba(0,212,255,', hex: '#00d4ff' },
              { view: 'library', icon: BookOpen, label: 'Prompt Library', desc: '100+ attack prompts', accent: 'rgba(199,125,255,', hex: '#c77dff' },
              { view: 'chain', icon: GitBranch, label: 'Exploit Chain', desc: 'Visualize attack flows', accent: 'rgba(255,107,53,', hex: '#ff6b35' },
              { view: 'reports', icon: TrendingUp, label: 'Reports', desc: 'Export findings', accent: 'rgba(0,255,136,', hex: '#00ff88' },
            ].map(({ view, icon: Icon, label, desc, accent, hex }) => (
              <button
                key={view}
                onClick={() => setView(view)}
                className="card text-left group"
                style={{ borderColor: `${accent}0.18)`, transition: 'border-color 150ms ease, box-shadow 150ms ease' }}
                onMouseEnter={e => {
                  (e.currentTarget as HTMLButtonElement).style.borderColor = `${accent}0.35)`;
                  (e.currentTarget as HTMLButtonElement).style.boxShadow = `0 4px 24px rgba(0,0,0,0.35), 0 0 20px ${accent}0.1), inset 0 1px 0 rgba(255,255,255,0.04)`;
                }}
                onMouseLeave={e => {
                  (e.currentTarget as HTMLButtonElement).style.borderColor = `${accent}0.18)`;
                  (e.currentTarget as HTMLButtonElement).style.boxShadow = '0 4px 24px rgba(0,0,0,0.35), inset 0 1px 0 rgba(255,255,255,0.04)';
                }}
              >
                <Icon size={18} className="mb-2" style={{ color: hex }} />
                <div className="text-sm font-semibold text-cyber-text">{label}</div>
                <div className="text-xs text-cyber-dim">{desc}</div>
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
