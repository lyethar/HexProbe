import React, { useState } from 'react';
import {
  FileText, Download, Upload, Trash2, Edit2, Save, X,
  AlertTriangle, CheckCircle, Clock, Shield, ChevronDown, ChevronUp,
  Filter, Search,
} from 'lucide-react';
import type { Store } from '../hooks/useStore';
import type { Finding, FindingStatus, Severity } from '../types';

interface Props { store: Store }

const SEV_ORDER: Severity[] = ['critical', 'high', 'medium', 'low', 'info'];

const STATUS_CONFIG: Record<FindingStatus, { label: string; color: string }> = {
  open:           { label: 'Open',          color: 'text-cyber-red' },
  confirmed:      { label: 'Confirmed',     color: 'text-cyber-orange' },
  mitigated:      { label: 'Mitigated',     color: 'text-cyber-green' },
  'false-positive': { label: 'False Positive', color: 'text-cyber-dim' },
};

const SEV_CONFIG: Record<Severity, { label: string; color: string }> = {
  critical: { label: 'Critical', color: 'text-cyber-red' },
  high:     { label: 'High',     color: 'text-cyber-orange' },
  medium:   { label: 'Medium',   color: 'text-cyber-amber' },
  low:      { label: 'Low',      color: 'text-cyber-blue' },
  info:     { label: 'Info',     color: 'text-cyber-dim' },
};

function FindingCard({ finding, entries, onEdit, onDelete, onStatus }: {
  finding: Finding;
  entries: Store['entries'];
  onEdit: () => void;
  onDelete: () => void;
  onStatus: (s: FindingStatus) => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const evidence = entries.filter(e => finding.evidenceIds.includes(e.id));
  const sevCfg = SEV_CONFIG[finding.severity];
  const staCfg = STATUS_CONFIG[finding.status];

  return (
    <div className={`card border-l-2 ${
      finding.severity === 'critical' ? 'border-l-cyber-red' :
      finding.severity === 'high' ? 'border-l-cyber-orange' :
      finding.severity === 'medium' ? 'border-l-cyber-amber' :
      finding.severity === 'low' ? 'border-l-cyber-blue' :
      'border-l-cyber-dim'
    }`}>
      <div className="flex items-start gap-3">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-sm font-semibold text-cyber-text">{finding.title}</span>
            <span className={`badge badge-${finding.severity}`}>{sevCfg.label}</span>
            <span className="badge bg-cyber-muted text-cyber-dim border-0 font-mono text-xs">{finding.category}</span>
            <span className={`badge bg-cyber-muted border-0 text-xs ${staCfg.color}`}>{staCfg.label}</span>
          </div>
          <div className="text-xs text-cyber-dim mt-1 flex items-center gap-2">
            <Clock size={11} />
            {new Date(finding.createdAt).toLocaleDateString()}
            {finding.cvssScore && (
              <span className="font-mono text-cyber-amber">CVSS: {finding.cvssScore.toFixed(1)}</span>
            )}
            {finding.cweId && (
              <span className="font-mono text-cyber-dim">CWE: {finding.cweId}</span>
            )}
          </div>
        </div>
        <div className="flex gap-1 flex-shrink-0">
          <button onClick={() => setExpanded(e => !e)} className="btn-ghost">
            {expanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
          </button>
          <button onClick={onEdit} className="btn-ghost"><Edit2 size={14} /></button>
          <button onClick={onDelete} className="btn-ghost text-cyber-red"><Trash2 size={14} /></button>
        </div>
      </div>

      {expanded && (
        <div className="mt-4 space-y-4 border-t border-cyber-border pt-4">
          {finding.description && (
            <div>
              <div className="text-xs font-semibold text-cyber-dim uppercase tracking-wider mb-1">Description</div>
              <p className="text-xs text-cyber-text">{finding.description}</p>
            </div>
          )}
          {finding.impact && (
            <div>
              <div className="text-xs font-semibold text-cyber-dim uppercase tracking-wider mb-1">Impact</div>
              <p className="text-xs text-cyber-text">{finding.impact}</p>
            </div>
          )}
          {finding.recommendation && (
            <div>
              <div className="text-xs font-semibold text-cyber-dim uppercase tracking-wider mb-1">Recommendation</div>
              <p className="text-xs text-cyber-text">{finding.recommendation}</p>
            </div>
          )}
          {evidence.length > 0 && (
            <div>
              <div className="text-xs font-semibold text-cyber-dim uppercase tracking-wider mb-2">Evidence ({evidence.length} test entries)</div>
              <div className="space-y-2">
                {evidence.map(e => (
                  <div key={e.id} className="bg-cyber-bg border border-cyber-border rounded p-2">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-xs font-medium text-cyber-text">{e.title}</span>
                      <span className={`badge badge-${e.outcome}`}>{e.outcome}</span>
                    </div>
                    <div className="text-xs font-mono text-cyber-dim line-clamp-2">{e.prompt.slice(0, 150)}…</div>
                  </div>
                ))}
              </div>
            </div>
          )}
          <div>
            <div className="text-xs font-semibold text-cyber-dim uppercase tracking-wider mb-2">Update Status</div>
            <div className="flex gap-2 flex-wrap">
              {(Object.keys(STATUS_CONFIG) as FindingStatus[]).map(s => (
                <button
                  key={s}
                  onClick={() => onStatus(s)}
                  className={`text-xs px-3 py-1.5 rounded border transition-colors ${
                    finding.status === s
                      ? 'bg-cyber-muted border-cyber-blue text-cyber-blue'
                      : 'border-cyber-border text-cyber-dim hover:text-cyber-text'
                  }`}
                >
                  {STATUS_CONFIG[s].label}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

const EMPTY_FINDING: Omit<Finding, 'id' | 'createdAt' | 'updatedAt'> = {
  sessionId: '',
  title: '',
  category: 'LLM01',
  severity: 'medium',
  status: 'open',
  description: '',
  impact: '',
  recommendation: '',
  evidenceIds: [],
  cvssScore: undefined,
  cweId: undefined,
};

export default function Reports({ store }: Props) {
  const { sessions, entries, findings, chains, addFinding, updateFinding, deleteFinding, exportData, importData, activeSessionId } = store;

  const [filterSev, setFilterSev] = useState<'all' | Severity>('all');
  const [filterSta, setFilterSta] = useState<'all' | FindingStatus>('all');
  const [filterSess, setFilterSess] = useState<'all' | string>('all');
  const [search, setSearch] = useState('');
  const [editId, setEditId] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState<Omit<Finding, 'id' | 'createdAt' | 'updatedAt'>>(EMPTY_FINDING);

  const filtered = findings.filter(f => {
    if (filterSev !== 'all' && f.severity !== filterSev) return false;
    if (filterSta !== 'all' && f.status !== filterSta) return false;
    if (filterSess !== 'all' && f.sessionId !== filterSess) return false;
    if (search && !f.title.toLowerCase().includes(search.toLowerCase()) && !f.description.toLowerCase().includes(search.toLowerCase())) return false;
    return true;
  }).sort((a, b) => SEV_ORDER.indexOf(a.severity) - SEV_ORDER.indexOf(b.severity));

  function openNew() {
    setEditId(null);
    setForm({ ...EMPTY_FINDING, sessionId: activeSessionId || '' });
    setShowForm(true);
  }

  function openEdit(f: Finding) {
    setEditId(f.id);
    setForm({ sessionId: f.sessionId, title: f.title, category: f.category, severity: f.severity, status: f.status, description: f.description, impact: f.impact, recommendation: f.recommendation, evidenceIds: f.evidenceIds, cvssScore: f.cvssScore, cweId: f.cweId });
    setShowForm(true);
  }

  function submitForm(e: React.FormEvent) {
    e.preventDefault();
    if (editId) {
      updateFinding(editId, form);
    } else {
      addFinding(form);
    }
    setShowForm(false);
    setEditId(null);
  }

  function generateMarkdownReport() {
    const lines: string[] = [
      '# AI Security Assessment Report',
      `> Generated: ${new Date().toLocaleString()}`,
      '',
      '## Executive Summary',
      '',
      `- **Total Sessions:** ${sessions.length}`,
      `- **Total Tests Conducted:** ${entries.length}`,
      `- **Total Findings:** ${findings.length}`,
      `- **Critical:** ${findings.filter(f => f.severity === 'critical').length}`,
      `- **High:** ${findings.filter(f => f.severity === 'high').length}`,
      `- **Medium:** ${findings.filter(f => f.severity === 'medium').length}`,
      `- **Low:** ${findings.filter(f => f.severity === 'low').length}`,
      '',
      '## Findings',
      '',
    ];

    SEV_ORDER.forEach(sev => {
      const sevFindings = findings.filter(f => f.severity === sev);
      if (sevFindings.length === 0) return;
      lines.push(`### ${sev.charAt(0).toUpperCase() + sev.slice(1)} Severity (${sevFindings.length})`, '');
      sevFindings.forEach(f => {
        const sess = sessions.find(s => s.id === f.sessionId);
        const evidence = entries.filter(e => f.evidenceIds.includes(e.id));
        lines.push(
          `#### ${f.title}`,
          `- **Category:** ${f.category}`,
          `- **Severity:** ${f.severity}`,
          `- **Status:** ${f.status}`,
          `- **Session:** ${sess?.name || 'N/A'} (${sess?.target || 'N/A'})`,
          f.cvssScore ? `- **CVSS Score:** ${f.cvssScore.toFixed(1)}` : '',
          f.cweId ? `- **CWE:** ${f.cweId}` : '',
          '',
          `**Description:** ${f.description || 'N/A'}`,
          '',
          `**Impact:** ${f.impact || 'N/A'}`,
          '',
          `**Recommendation:** ${f.recommendation || 'N/A'}`,
          '',
        );
        if (evidence.length > 0) {
          lines.push(`**Evidence (${evidence.length} test entries):**`, '');
          evidence.forEach(e => {
            lines.push(
              `- **${e.title}** [${e.outcome}]`,
              `  \`\`\``,
              `  ${e.prompt.slice(0, 200)}${e.prompt.length > 200 ? '...' : ''}`,
              `  \`\`\``,
            );
          });
          lines.push('');
        }
        lines.push('---', '');
      });
    });

    lines.push('## Test Sessions', '');
    sessions.forEach(s => {
      const sessEntries = entries.filter(e => e.sessionId === s.id);
      const sessFindings = findings.filter(f => f.sessionId === s.id);
      lines.push(
        `### ${s.name}`,
        `- **Target:** ${s.target}`,
        `- **Model:** ${s.modelProvider} / ${s.modelName}`,
        `- **Status:** ${s.status}`,
        `- **Tests:** ${sessEntries.length}`,
        `- **Findings:** ${sessFindings.length}`,
        `- **Started:** ${new Date(s.startedAt).toLocaleString()}`,
        '',
      );
    });

    return lines.filter(l => l !== null).join('\n');
  }

  function downloadReport(format: 'markdown' | 'json') {
    if (format === 'json') {
      exportData();
    } else {
      const md = generateMarkdownReport();
      const blob = new Blob([md], { type: 'text/markdown' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `ai-security-report-${new Date().toISOString().split('T')[0]}.md`;
      a.click();
      URL.revokeObjectURL(url);
    }
  }

  function handleImport(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = ev => {
      const text = ev.target?.result as string;
      const ok = importData(text);
      if (!ok) alert('Failed to import: invalid JSON format.');
    };
    reader.readAsText(file);
    e.target.value = '';
  }

  const critCount = findings.filter(f => f.severity === 'critical').length;
  const highCount = findings.filter(f => f.severity === 'high').length;
  const openCount = findings.filter(f => f.status === 'open' || f.status === 'confirmed').length;

  return (
    <div className="p-6 max-w-5xl mx-auto space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-xl font-bold text-cyber-text flex items-center gap-2">
            <FileText size={22} className="text-cyber-blue" /> Reports & Findings
          </h1>
          <p className="text-sm text-cyber-dim mt-1">
            Document, track, and export security findings across all sessions.
          </p>
        </div>
        <div className="flex gap-2 flex-wrap">
          <button onClick={openNew} className="btn-primary text-xs">
            <AlertTriangle size={13} /> Add Finding
          </button>
          <button onClick={() => downloadReport('markdown')} className="btn-secondary text-xs">
            <Download size={13} /> MD Report
          </button>
          <button onClick={() => downloadReport('json')} className="btn-secondary text-xs">
            <Download size={13} /> Export JSON
          </button>
          <label className="btn-secondary text-xs cursor-pointer">
            <Upload size={13} /> Import
            <input type="file" accept=".json" className="hidden" onChange={handleImport} />
          </label>
        </div>
      </div>

      {/* Summary stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {[
          { label: 'Total Findings', value: findings.length, color: 'text-cyber-text' },
          { label: 'Critical', value: critCount, color: 'text-cyber-red' },
          { label: 'High', value: highCount, color: 'text-cyber-orange' },
          { label: 'Open / Confirmed', value: openCount, color: 'text-cyber-amber' },
        ].map(({ label, value, color }) => (
          <div key={label} className="card text-center">
            <div className={`text-2xl font-bold ${color}`}>{value}</div>
            <div className="text-xs text-cyber-dim mt-0.5">{label}</div>
          </div>
        ))}
      </div>

      {/* Filters */}
      <div className="flex gap-3 flex-wrap">
        <div className="relative flex-1 min-w-40">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-cyber-dim" />
          <input className="input pl-9 text-xs" placeholder="Search findings..." value={search} onChange={e => setSearch(e.target.value)} />
        </div>
        <select className="select text-xs w-36" value={filterSev} onChange={e => setFilterSev(e.target.value as typeof filterSev)}>
          <option value="all">All Severities</option>
          {SEV_ORDER.map(s => <option key={s} value={s}>{s.charAt(0).toUpperCase() + s.slice(1)}</option>)}
        </select>
        <select className="select text-xs w-40" value={filterSta} onChange={e => setFilterSta(e.target.value as typeof filterSta)}>
          <option value="all">All Statuses</option>
          {(Object.keys(STATUS_CONFIG) as FindingStatus[]).map(s => <option key={s} value={s}>{STATUS_CONFIG[s].label}</option>)}
        </select>
        <select className="select text-xs w-44" value={filterSess} onChange={e => setFilterSess(e.target.value)}>
          <option value="all">All Sessions</option>
          {sessions.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
        </select>
      </div>

      {/* Results count */}
      <div className="text-xs text-cyber-dim">
        Showing <span className="text-cyber-text font-medium">{filtered.length}</span> of {findings.length} findings
      </div>

      {/* Findings list */}
      {filtered.length === 0 ? (
        <div className="card text-center py-12">
          <Shield size={40} className="text-cyber-dim mx-auto mb-3 opacity-40" />
          <p className="text-sm text-cyber-dim">
            {findings.length === 0 ? 'No findings yet. Log tests in the Prompt Lab and promote vulnerable ones to findings.' : 'No findings match your filters.'}
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.map(f => (
            <FindingCard
              key={f.id}
              finding={f}
              entries={entries}
              onEdit={() => openEdit(f)}
              onDelete={() => { if (confirm(`Delete finding "${f.title}"?`)) deleteFinding(f.id); }}
              onStatus={s => updateFinding(f.id, { status: s })}
            />
          ))}
        </div>
      )}

      {/* Add/Edit finding modal */}
      {showForm && (
        <div className="fixed inset-0 bg-black bg-opacity-70 flex items-center justify-center z-50 p-4">
          <div className="bg-cyber-card border border-cyber-border rounded-xl w-full max-w-lg shadow-2xl max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between p-4 border-b border-cyber-border sticky top-0 bg-cyber-card z-10">
              <h2 className="text-sm font-semibold text-cyber-text">{editId ? 'Edit Finding' : 'New Finding'}</h2>
              <button onClick={() => setShowForm(false)} className="text-cyber-dim hover:text-cyber-text"><X size={18} /></button>
            </div>
            <form onSubmit={submitForm} className="p-4 space-y-3">
              <div>
                <label className="text-xs text-cyber-dim block mb-1">Session</label>
                <select className="select text-xs" value={form.sessionId} onChange={e => setForm(f => ({ ...f, sessionId: e.target.value }))}>
                  <option value="">— None —</option>
                  {sessions.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                </select>
              </div>
              <div>
                <label className="text-xs text-cyber-dim block mb-1">Title *</label>
                <input className="input" value={form.title} onChange={e => setForm(f => ({ ...f, title: e.target.value }))} required />
              </div>
              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="text-xs text-cyber-dim block mb-1">Category</label>
                  <input className="input text-xs font-mono" value={form.category} onChange={e => setForm(f => ({ ...f, category: e.target.value }))} />
                </div>
                <div>
                  <label className="text-xs text-cyber-dim block mb-1">Severity</label>
                  <select className="select text-xs" value={form.severity} onChange={e => setForm(f => ({ ...f, severity: e.target.value as Severity }))}>
                    {SEV_ORDER.map(s => <option key={s} value={s}>{s.charAt(0).toUpperCase() + s.slice(1)}</option>)}
                  </select>
                </div>
                <div>
                  <label className="text-xs text-cyber-dim block mb-1">Status</label>
                  <select className="select text-xs" value={form.status} onChange={e => setForm(f => ({ ...f, status: e.target.value as FindingStatus }))}>
                    {(Object.keys(STATUS_CONFIG) as FindingStatus[]).map(s => <option key={s} value={s}>{STATUS_CONFIG[s].label}</option>)}
                  </select>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs text-cyber-dim block mb-1">CVSS Score</label>
                  <input className="input text-xs" type="number" min="0" max="10" step="0.1" value={form.cvssScore ?? ''} onChange={e => setForm(f => ({ ...f, cvssScore: e.target.value ? parseFloat(e.target.value) : undefined }))} />
                </div>
                <div>
                  <label className="text-xs text-cyber-dim block mb-1">CWE ID</label>
                  <input className="input text-xs font-mono" placeholder="e.g. CWE-20" value={form.cweId ?? ''} onChange={e => setForm(f => ({ ...f, cweId: e.target.value || undefined }))} />
                </div>
              </div>
              <div>
                <label className="text-xs text-cyber-dim block mb-1">Description</label>
                <textarea className="textarea" rows={3} value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} />
              </div>
              <div>
                <label className="text-xs text-cyber-dim block mb-1">Impact</label>
                <textarea className="textarea" rows={2} value={form.impact} onChange={e => setForm(f => ({ ...f, impact: e.target.value }))} />
              </div>
              <div>
                <label className="text-xs text-cyber-dim block mb-1">Recommendation</label>
                <textarea className="textarea" rows={2} value={form.recommendation} onChange={e => setForm(f => ({ ...f, recommendation: e.target.value }))} />
              </div>
              <div className="flex justify-end gap-2 pt-1">
                <button type="button" onClick={() => setShowForm(false)} className="btn-secondary">Cancel</button>
                <button type="submit" className="btn-primary"><Save size={14} /> {editId ? 'Save' : 'Create Finding'}</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
