import React, { useState } from 'react';
import {
  Plus, Trash2, Edit2, CheckCircle, Archive, Play,
  Target, Tag, Clock, ChevronRight, X, Save,
} from 'lucide-react';
import type { Store } from '../hooks/useStore';
import type { TestSession, SessionStatus } from '../types';

interface Props { store: Store }

const STATUS_CONFIG: Record<SessionStatus, { label: string; color: string; dot: string }> = {
  active:    { label: 'Active',    color: 'text-cyber-green',  dot: 'bg-cyber-green' },
  completed: { label: 'Completed', color: 'text-cyber-blue',   dot: 'bg-cyber-blue' },
  archived:  { label: 'Archived',  color: 'text-cyber-dim',    dot: 'bg-cyber-dim' },
};

const PROVIDERS = ['Anthropic', 'OpenAI', 'Google', 'Meta', 'Mistral', 'Cohere', 'Custom / Self-hosted'];
const MODELS: Record<string, string[]> = {
  Anthropic: ['claude-opus-4-7', 'claude-sonnet-4-6', 'claude-haiku-4-5', 'claude-3-5-sonnet-20241022'],
  OpenAI: ['gpt-4o', 'gpt-4o-mini', 'gpt-4-turbo', 'gpt-4', 'o1', 'o3'],
  Google: ['gemini-2.0-flash', 'gemini-1.5-pro', 'gemini-1.5-flash'],
  Meta: ['llama-3.3-70b', 'llama-3.1-405b'],
  Mistral: ['mistral-large', 'mistral-small'],
  Cohere: ['command-r-plus', 'command-r'],
  'Custom / Self-hosted': ['custom'],
};

const EMPTY_FORM = {
  name: '',
  target: '',
  modelProvider: 'Anthropic',
  modelName: 'claude-sonnet-4-6',
  endpoint: '',
  description: '',
  status: 'active' as SessionStatus,
  tags: [] as string[],
};

type FormState = typeof EMPTY_FORM;

export default function Sessions({ store }: Props) {
  const { sessions, entries, findings, createSession, updateSession, deleteSession, setActiveSession, setView } = store;
  const [showForm, setShowForm] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [form, setForm] = useState<FormState>(EMPTY_FORM);
  const [tagInput, setTagInput] = useState('');
  const [filter, setFilter] = useState<SessionStatus | 'all'>('all');

  function openNew() {
    setEditId(null);
    setForm(EMPTY_FORM);
    setTagInput('');
    setShowForm(true);
  }

  function openEdit(sess: TestSession) {
    setEditId(sess.id);
    setForm({
      name: sess.name,
      target: sess.target,
      modelProvider: sess.modelProvider,
      modelName: sess.modelName,
      endpoint: sess.endpoint || '',
      description: sess.description,
      status: sess.status,
      tags: [...sess.tags],
    });
    setTagInput('');
    setShowForm(true);
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!form.name.trim() || !form.target.trim()) return;
    if (editId) {
      updateSession(editId, form);
    } else {
      createSession(form);
    }
    setShowForm(false);
    setEditId(null);
  }

  function addTag() {
    const t = tagInput.trim().toLowerCase();
    if (t && !form.tags.includes(t)) {
      setForm(f => ({ ...f, tags: [...f.tags, t] }));
    }
    setTagInput('');
  }

  const filtered = sessions.filter(s => filter === 'all' || s.status === filter);

  return (
    <div className="p-6 space-y-6 max-w-5xl mx-auto">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-cyber-text">Test Sessions</h1>
          <p className="text-sm text-cyber-dim mt-1">Manage engagement contexts for each target LLM application.</p>
        </div>
        <button onClick={openNew} className="btn-primary">
          <Plus size={16} /> New Session
        </button>
      </div>

      {/* Filter tabs */}
      <div className="flex gap-1 bg-cyber-surface border border-cyber-border rounded-lg p-1 w-fit">
        {(['all', 'active', 'completed', 'archived'] as const).map(f => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={`px-3 py-1.5 rounded text-xs font-medium transition-colors capitalize ${
              filter === f
                ? 'bg-cyber-muted text-cyber-text'
                : 'text-cyber-dim hover:text-cyber-text'
            }`}
          >
            {f === 'all' ? `All (${sessions.length})` : `${f.charAt(0).toUpperCase() + f.slice(1)} (${sessions.filter(s => s.status === f).length})`}
          </button>
        ))}
      </div>

      {/* Sessions list */}
      {filtered.length === 0 ? (
        <div className="card text-center py-12">
          <Target size={40} className="text-cyber-dim mx-auto mb-3 opacity-40" />
          <p className="text-sm text-cyber-dim">
            {sessions.length === 0 ? 'No sessions yet. Create one to start testing.' : 'No sessions match this filter.'}
          </p>
          {sessions.length === 0 && (
            <button onClick={openNew} className="btn-primary mx-auto mt-4">
              <Plus size={15} /> Create Session
            </button>
          )}
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.map(sess => {
            const sessEntries = entries.filter(e => e.sessionId === sess.id);
            const sessFindings = findings.filter(f => f.sessionId === sess.id);
            const vulns = sessEntries.filter(e => e.outcome === 'vulnerable').length;
            const critical = sessFindings.filter(f => f.severity === 'critical').length;
            const high = sessFindings.filter(f => f.severity === 'high').length;
            const cfg = STATUS_CONFIG[sess.status];
            const isActive = store.activeSessionId === sess.id;

            return (
              <div
                key={sess.id}
                className={`card hover:border-opacity-60 transition-all ${isActive ? 'border-cyber-blue border-opacity-40 glow-blue' : ''}`}
              >
                <div className="flex items-start gap-4">
                  {/* Status dot */}
                  <div className={`w-2 h-2 rounded-full mt-2 flex-shrink-0 ${cfg.dot} ${sess.status === 'active' ? 'animate-pulse-slow' : ''}`} />

                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <h3 className="text-sm font-semibold text-cyber-text">{sess.name}</h3>
                          {isActive && (
                            <span className="badge bg-cyber-blue bg-opacity-20 text-cyber-blue border border-cyber-blue border-opacity-30">
                              Active
                            </span>
                          )}
                          <span className={`text-xs ${cfg.color}`}>{cfg.label}</span>
                        </div>
                        <div className="text-xs text-cyber-dim mt-0.5 font-mono">{sess.target}</div>
                      </div>
                      <div className="flex gap-1 flex-shrink-0">
                        <button
                          onClick={() => { setActiveSession(sess.id); setView('promptlab'); }}
                          className="btn-ghost text-cyber-green"
                          title="Start testing this session"
                        >
                          <Play size={14} />
                        </button>
                        <button onClick={() => openEdit(sess)} className="btn-ghost" title="Edit">
                          <Edit2 size={14} />
                        </button>
                        <button
                          onClick={() => updateSession(sess.id, { status: sess.status === 'active' ? 'completed' : 'active' })}
                          className="btn-ghost"
                          title={sess.status === 'active' ? 'Mark complete' : 'Reopen'}
                        >
                          {sess.status === 'active' ? <CheckCircle size={14} /> : <Archive size={14} />}
                        </button>
                        <button
                          onClick={() => { if (confirm(`Delete session "${sess.name}"?`)) deleteSession(sess.id); }}
                          className="btn-ghost text-cyber-red"
                          title="Delete"
                        >
                          <Trash2 size={14} />
                        </button>
                      </div>
                    </div>

                    {sess.description && (
                      <p className="text-xs text-cyber-dim mt-2">{sess.description}</p>
                    )}

                    <div className="flex items-center gap-4 mt-3 flex-wrap">
                      <div className="text-xs text-cyber-dim">
                        <span className="text-cyber-text font-medium">{sess.modelProvider}</span>
                        <span className="mx-1">·</span>
                        <span className="font-mono">{sess.modelName}</span>
                      </div>
                      <div className="flex items-center gap-1 text-xs text-cyber-dim">
                        <Clock size={12} />
                        {new Date(sess.startedAt).toLocaleDateString()}
                      </div>
                    </div>

                    <div className="flex items-center gap-3 mt-2 flex-wrap">
                      <div className="text-xs text-cyber-dim">
                        <span className="text-cyber-text font-medium">{sessEntries.length}</span> tests
                        {vulns > 0 && <span className="text-cyber-red ml-1">· {vulns} vulnerable</span>}
                      </div>
                      <div className="text-xs text-cyber-dim">
                        <span className="text-cyber-text font-medium">{sessFindings.length}</span> findings
                        {critical > 0 && <span className="text-cyber-red ml-1">· {critical} critical</span>}
                        {high > 0 && !critical && <span className="text-cyber-orange ml-1">· {high} high</span>}
                      </div>
                      {sess.tags.length > 0 && (
                        <div className="flex gap-1 flex-wrap">
                          {sess.tags.map(tag => (
                            <span key={tag} className="badge bg-cyber-muted text-cyber-dim border-0 text-xs">
                              {tag}
                            </span>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Modal form */}
      {showForm && (
        <div className="fixed inset-0 bg-black bg-opacity-70 flex items-center justify-center z-50 p-4">
          <div className="bg-cyber-card border border-cyber-border rounded-xl w-full max-w-lg shadow-2xl">
            <div className="flex items-center justify-between p-5 border-b border-cyber-border">
              <h2 className="text-base font-semibold text-cyber-text">
                {editId ? 'Edit Session' : 'New Test Session'}
              </h2>
              <button onClick={() => setShowForm(false)} className="text-cyber-dim hover:text-cyber-text">
                <X size={18} />
              </button>
            </div>
            <form onSubmit={handleSubmit} className="p-5 space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="col-span-2">
                  <label className="text-xs text-cyber-dim block mb-1">Session Name *</label>
                  <input
                    className="input"
                    placeholder="e.g. Customer Support Bot – Q1 Assessment"
                    value={form.name}
                    onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                    required
                  />
                </div>
                <div className="col-span-2">
                  <label className="text-xs text-cyber-dim block mb-1">Target System / Application *</label>
                  <input
                    className="input"
                    placeholder="e.g. https://app.example.com/chat or internal-ai-bot"
                    value={form.target}
                    onChange={e => setForm(f => ({ ...f, target: e.target.value }))}
                    required
                  />
                </div>
                <div>
                  <label className="text-xs text-cyber-dim block mb-1">Model Provider</label>
                  <select
                    className="select"
                    value={form.modelProvider}
                    onChange={e => setForm(f => ({ ...f, modelProvider: e.target.value, modelName: MODELS[e.target.value]?.[0] || '' }))}
                  >
                    {PROVIDERS.map(p => <option key={p} value={p}>{p}</option>)}
                  </select>
                </div>
                <div>
                  <label className="text-xs text-cyber-dim block mb-1">Model Name</label>
                  <select
                    className="select"
                    value={form.modelName}
                    onChange={e => setForm(f => ({ ...f, modelName: e.target.value }))}
                  >
                    {(MODELS[form.modelProvider] || []).map(m => (
                      <option key={m} value={m}>{m}</option>
                    ))}
                  </select>
                </div>
                <div className="col-span-2">
                  <label className="text-xs text-cyber-dim block mb-1">Endpoint / URL (optional)</label>
                  <input
                    className="input font-mono text-xs"
                    placeholder="https://api.example.com/v1/chat or leave blank"
                    value={form.endpoint}
                    onChange={e => setForm(f => ({ ...f, endpoint: e.target.value }))}
                  />
                </div>
                <div className="col-span-2">
                  <label className="text-xs text-cyber-dim block mb-1">Description</label>
                  <textarea
                    className="textarea"
                    rows={3}
                    placeholder="Scope, objectives, authorization notes..."
                    value={form.description}
                    onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
                  />
                </div>
                <div className="col-span-2">
                  <label className="text-xs text-cyber-dim block mb-1">Tags</label>
                  <div className="flex gap-2">
                    <input
                      className="input flex-1"
                      placeholder="Add tag and press Enter"
                      value={tagInput}
                      onChange={e => setTagInput(e.target.value)}
                      onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); addTag(); } }}
                    />
                    <button type="button" onClick={addTag} className="btn-secondary">
                      <Tag size={14} />
                    </button>
                  </div>
                  {form.tags.length > 0 && (
                    <div className="flex gap-1 flex-wrap mt-2">
                      {form.tags.map(tag => (
                        <span key={tag} className="badge bg-cyber-muted text-cyber-dim border-0 flex items-center gap-1">
                          {tag}
                          <button
                            type="button"
                            onClick={() => setForm(f => ({ ...f, tags: f.tags.filter(t => t !== tag) }))}
                            className="hover:text-cyber-red"
                          >
                            <X size={10} />
                          </button>
                        </span>
                      ))}
                    </div>
                  )}
                </div>
                {editId && (
                  <div>
                    <label className="text-xs text-cyber-dim block mb-1">Status</label>
                    <select
                      className="select"
                      value={form.status}
                      onChange={e => setForm(f => ({ ...f, status: e.target.value as SessionStatus }))}
                    >
                      <option value="active">Active</option>
                      <option value="completed">Completed</option>
                      <option value="archived">Archived</option>
                    </select>
                  </div>
                )}
              </div>
              <div className="flex justify-end gap-2 pt-2">
                <button type="button" onClick={() => setShowForm(false)} className="btn-secondary">Cancel</button>
                <button type="submit" className="btn-primary">
                  <Save size={15} /> {editId ? 'Save Changes' : 'Create Session'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
