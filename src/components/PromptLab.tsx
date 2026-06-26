import React, { useState } from 'react';
import {
  FlaskConical, Copy, Check, Plus, Trash2, Edit2,
  BookOpen, Tag, X, Save, AlertTriangle, ChevronDown, ChevronUp,
  Clock, CheckCircle, HelpCircle, Minus, Upload, Bot, Thermometer, Fingerprint,
} from 'lucide-react';
import type { Store } from '../hooks/useStore';
import type { Severity, Outcome, TestEntry } from '../types';
import { PROMPT_LIBRARY } from '../data/prompts';
import CsvImport from './CsvImport';
import EvaluationPanel from './EvaluationPanel';
import TemperatureProbe from './TemperatureProbe';
import ModelFingerprint from './ModelFingerprint';

type ActiveTab = 'lab' | 'temp' | 'fingerprint' | 'csv' | 'eval';

interface Props { store: Store }

const SEVERITY_OPTIONS: Severity[] = ['critical', 'high', 'medium', 'low', 'info'];
const OUTCOME_OPTIONS: { value: Outcome; label: string; icon: React.ElementType; color: string }[] = [
  { value: 'vulnerable',     label: 'Vulnerable',     icon: AlertTriangle, color: 'text-cyber-red' },
  { value: 'partial',        label: 'Partial',        icon: Minus,         color: 'text-cyber-amber' },
  { value: 'not-vulnerable', label: 'Not Vulnerable', icon: CheckCircle,   color: 'text-cyber-green' },
  { value: 'inconclusive',   label: 'Inconclusive',   icon: HelpCircle,    color: 'text-cyber-dim' },
];

const OWASP_CATS = [
  { id: 'LLM01', name: 'Prompt Injection' },
  { id: 'LLM02', name: 'Insecure Output Handling' },
  { id: 'LLM03', name: 'Training Data Poisoning' },
  { id: 'LLM04', name: 'Model Denial of Service' },
  { id: 'LLM05', name: 'Supply Chain Vulnerabilities' },
  { id: 'LLM06', name: 'Sensitive Information Disclosure' },
  { id: 'LLM07', name: 'Insecure Plugin Design' },
  { id: 'LLM08', name: 'Excessive Agency' },
  { id: 'LLM09', name: 'Overreliance' },
  { id: 'LLM10', name: 'Model Theft' },
  { id: 'APE',   name: 'APE Taxonomy' },
  { id: 'ARC',   name: 'Arcanum Taxonomy' },
  { id: 'CUSTOM', name: 'Custom' },
];

function OutcomeIcon({ outcome }: { outcome: Outcome }) {
  const cfg = OUTCOME_OPTIONS.find(o => o.value === outcome);
  if (!cfg) return null;
  const Icon = cfg.icon;
  return <Icon size={14} className={cfg.color} />;
}

function EntryCard({ entry, onEdit, onDelete, onPromote }: {
  entry: TestEntry;
  onEdit: () => void;
  onDelete: () => void;
  onPromote: () => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const [copied, setCopied] = useState(false);

  function copy() {
    navigator.clipboard.writeText(entry.prompt);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  return (
    <div className={`card border-l-2 ${
      entry.outcome === 'vulnerable' ? 'border-l-cyber-red' :
      entry.outcome === 'partial' ? 'border-l-cyber-amber' :
      entry.outcome === 'not-vulnerable' ? 'border-l-cyber-green' :
      'border-l-cyber-muted'
    }`}>
      <div className="flex items-start gap-3">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <OutcomeIcon outcome={entry.outcome} />
            <span className="text-sm font-medium text-cyber-text">{entry.title}</span>
            <span className={`badge badge-${entry.severity}`}>{entry.severity}</span>
            <span className="badge bg-cyber-muted text-cyber-dim border-0 font-mono text-xs">{entry.category}</span>
          </div>
          <div className="text-xs text-cyber-dim mt-1 flex items-center gap-2">
            <Clock size={11} />
            {new Date(entry.timestamp).toLocaleString()}
            {entry.tags.length > 0 && (
              <span className="flex gap-1">
                {entry.tags.slice(0, 3).map(t => (
                  <span key={t} className="badge bg-cyber-muted text-cyber-dim border-0">{t}</span>
                ))}
              </span>
            )}
          </div>
        </div>
        <div className="flex gap-1 flex-shrink-0">
          <button onClick={copy} className="btn-ghost" title="Copy prompt">
            {copied ? <Check size={14} className="text-cyber-green" /> : <Copy size={14} />}
          </button>
          <button onClick={() => setExpanded(e => !e)} className="btn-ghost" title="Expand">
            {expanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
          </button>
          <button onClick={onEdit} className="btn-ghost" title="Edit">
            <Edit2 size={14} />
          </button>
          <button onClick={onDelete} className="btn-ghost text-cyber-red" title="Delete">
            <Trash2 size={14} />
          </button>
        </div>
      </div>

      {expanded && (
        <div className="mt-3 space-y-3">
          <div>
            <div className="text-xs text-cyber-dim mb-1 font-medium">PROMPT</div>
            <div className="prompt-block text-xs max-h-48 overflow-y-auto">{entry.prompt}</div>
          </div>
          {entry.response && (
            <div>
              <div className="text-xs text-cyber-dim mb-1 font-medium">RESPONSE</div>
              <div className="prompt-block text-xs max-h-48 overflow-y-auto text-cyber-green">{entry.response}</div>
            </div>
          )}
          {entry.notes && (
            <div>
              <div className="text-xs text-cyber-dim mb-1 font-medium">NOTES</div>
              <div className="text-xs text-cyber-text">{entry.notes}</div>
            </div>
          )}
          {(entry.outcome === 'vulnerable' || entry.outcome === 'partial') && (
            <button onClick={onPromote} className="btn-secondary text-xs">
              <Plus size={13} /> Promote to Finding
            </button>
          )}
        </div>
      )}
    </div>
  );
}

export default function PromptLab({ store }: Props) {
  const {
    sessions, activeSessionId, activeSession,
    addEntry, updateEntry, deleteEntry, addFinding, setActiveSession, setView,
    sessionEntries,
  } = store;

  const [activeTab, setActiveTab] = useState<ActiveTab>('lab');

  const [prompt, setPrompt] = useState('');
  const [response, setResponse] = useState('');
  const [title, setTitle] = useState('');
  const [category, setCategory] = useState('LLM01');
  const [severity, setSeverity] = useState<Severity>('medium');
  const [outcome, setOutcome] = useState<Outcome>('inconclusive');
  const [notes, setNotes] = useState('');
  const [tagInput, setTagInput] = useState('');
  const [tags, setTags] = useState<string[]>([]);

  const [editingId, setEditingId] = useState<string | null>(null);
  const [showLibPicker, setShowLibPicker] = useState(false);
  const [libSearch, setLibSearch] = useState('');
  const [libCat, setLibCat] = useState('all');
  const [showFindingModal, setShowFindingModal] = useState(false);
  const [promoteEntry, setPromoteEntry] = useState<TestEntry | null>(null);
  const [findingForm, setFindingForm] = useState({ title: '', description: '', impact: '', recommendation: '', cvssScore: '' });

  const sessEntries = activeSessionId ? sessionEntries(activeSessionId) : [];

  function resetForm() {
    setPrompt(''); setResponse(''); setTitle(''); setCategory('LLM01');
    setSeverity('medium'); setOutcome('inconclusive'); setNotes('');
    setTags([]); setTagInput(''); setEditingId(null);
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!activeSessionId || !title.trim() || !prompt.trim()) return;
    const catName = OWASP_CATS.find(c => c.id === category)?.name || category;

    if (editingId) {
      updateEntry(editingId, { title, category, categoryName: catName, severity, prompt, response, outcome, notes, tags });
    } else {
      addEntry({ sessionId: activeSessionId, title, category, categoryName: catName, severity, prompt, response, outcome, notes, tags });
    }
    resetForm();
  }

  function startEdit(entry: TestEntry) {
    setEditingId(entry.id);
    setTitle(entry.title);
    setCategory(entry.category);
    setSeverity(entry.severity);
    setPrompt(entry.prompt);
    setResponse(entry.response);
    setOutcome(entry.outcome);
    setNotes(entry.notes);
    setTags([...entry.tags]);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  function useLibraryPrompt(p: typeof PROMPT_LIBRARY[0]) {
    setPrompt(p.prompt);
    setTitle(p.title);
    setCategory(p.category);
    setSeverity(p.severity);
    setNotes(`Technique: ${p.technique}\nObjective: ${p.objective}`);
    setTags([...p.tags]);
    setShowLibPicker(false);
  }

  function openPromote(entry: TestEntry) {
    setPromoteEntry(entry);
    setFindingForm({
      title: `Finding: ${entry.title}`,
      description: `Vulnerability identified during ${entry.categoryName} testing.`,
      impact: '',
      recommendation: '',
      cvssScore: '',
    });
    setShowFindingModal(true);
  }

  function submitFinding(e: React.FormEvent) {
    e.preventDefault();
    if (!activeSessionId || !promoteEntry) return;
    addFinding({
      sessionId: activeSessionId,
      title: findingForm.title,
      category: promoteEntry.category,
      severity: promoteEntry.severity,
      status: 'open',
      description: findingForm.description,
      impact: findingForm.impact,
      recommendation: findingForm.recommendation,
      evidenceIds: [promoteEntry.id],
      cvssScore: findingForm.cvssScore ? parseFloat(findingForm.cvssScore) : undefined,
    });
    setShowFindingModal(false);
    setPromoteEntry(null);
  }

  function addTag() {
    const t = tagInput.trim().toLowerCase();
    if (t && !tags.includes(t)) setTags(tg => [...tg, t]);
    setTagInput('');
  }

  const filteredLib = PROMPT_LIBRARY.filter(p => {
    const matchCat = libCat === 'all' || p.category === libCat;
    const matchSearch = !libSearch || [p.title, p.technique, p.description, p.category].some(
      f => f.toLowerCase().includes(libSearch.toLowerCase())
    );
    return matchCat && matchSearch;
  });

  return (
    <div className="p-6 max-w-6xl mx-auto space-y-6">
      {/* ── Page header ── */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-xl font-bold text-cyber-text flex items-center gap-2">
            <FlaskConical size={22} className="text-cyber-blue" /> Prompt Lab
          </h1>
          <p className="text-sm text-cyber-dim mt-1">Log prompts, capture responses, and evaluate attack outcomes.</p>
        </div>
        {/* Session selector */}
        <div className="flex items-center gap-2">
          <select
            className="select text-xs w-56"
            value={activeSessionId ?? ''}
            onChange={e => setActiveSession(e.target.value || null)}
          >
            <option value="">— Select a session —</option>
            {sessions.filter(s => s.status === 'active').map(s => (
              <option key={s.id} value={s.id}>{s.name}</option>
            ))}
          </select>
          {!activeSessionId && (
            <button onClick={() => setView('sessions')} className="btn-secondary text-xs">
              <Plus size={13} /> New
            </button>
          )}
        </div>
      </div>

      {/* ── Tab bar ── */}
      <div className="flex gap-1 border-b border-cyber-border">
        {([
          { id: 'lab',         label: 'Test Lab',          Icon: FlaskConical },
          { id: 'temp',        label: 'Temperature Probe', Icon: Thermometer },
          { id: 'fingerprint', label: 'Model Fingerprint', Icon: Fingerprint },
          { id: 'csv',         label: 'CSV Import',        Icon: Upload },
          { id: 'eval',        label: 'AI Evaluator',      Icon: Bot },
        ] as const).map(({ id, label, Icon }) => (
          <button
            key={id}
            onClick={() => setActiveTab(id)}
            className={`flex items-center gap-1.5 px-4 py-2 text-xs font-medium border-b-2 transition-all -mb-px ${
              activeTab === id
                ? 'border-cyber-blue text-cyber-blue'
                : 'border-transparent text-cyber-dim hover:text-cyber-text'
            }`}
          >
            <Icon size={13} />
            {label}
          </button>
        ))}
      </div>

      {/* ── Temperature Probe tab ── */}
      {activeTab === 'temp' && <TemperatureProbe store={store} />}

      {/* ── Model Fingerprint tab ── */}
      {activeTab === 'fingerprint' && <ModelFingerprint store={store} />}

      {/* ── CSV Import tab ── */}
      {activeTab === 'csv' && <CsvImport store={store} />}

      {/* ── AI Evaluator tab ── */}
      {activeTab === 'eval' && <EvaluationPanel store={store} />}

      {/* ── Test Lab tab ── */}
      {activeTab === 'lab' && (!activeSessionId ? (
        <div className="card text-center py-12">
          <FlaskConical size={40} className="text-cyber-dim mx-auto mb-3 opacity-40" />
          <p className="text-sm text-cyber-dim">Select or create a test session to start the Prompt Lab.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
          {/* Left: Form */}
          <div className="space-y-4">
            <div className="card">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-sm font-semibold text-cyber-text">
                  {editingId ? 'Edit Test Entry' : 'New Test Entry'}
                </h2>
                <button
                  onClick={() => setShowLibPicker(true)}
                  className="btn-secondary text-xs"
                >
                  <BookOpen size={13} /> From Library
                </button>
              </div>

              <form onSubmit={handleSubmit} className="space-y-3">
                <div>
                  <label className="text-xs text-cyber-dim block mb-1">Test Title *</label>
                  <input className="input" placeholder="e.g. DAN jailbreak attempt" value={title} onChange={e => setTitle(e.target.value)} required />
                </div>

                <div className="grid grid-cols-3 gap-3">
                  <div>
                    <label className="text-xs text-cyber-dim block mb-1">Category</label>
                    <select className="select text-xs" value={category} onChange={e => setCategory(e.target.value)}>
                      {OWASP_CATS.map(c => <option key={c.id} value={c.id}>{c.id} – {c.name}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="text-xs text-cyber-dim block mb-1">Severity</label>
                    <select className="select text-xs" value={severity} onChange={e => setSeverity(e.target.value as Severity)}>
                      {SEVERITY_OPTIONS.map(s => <option key={s} value={s}>{s.charAt(0).toUpperCase() + s.slice(1)}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="text-xs text-cyber-dim block mb-1">Outcome</label>
                    <select className="select text-xs" value={outcome} onChange={e => setOutcome(e.target.value as Outcome)}>
                      {OUTCOME_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                    </select>
                  </div>
                </div>

                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="text-xs text-cyber-dim">Prompt *</label>
                    <button type="button" onClick={() => setShowLibPicker(true)} className="text-xs text-cyber-blue hover:underline">
                      Load from library
                    </button>
                  </div>
                  <textarea
                    className="textarea"
                    rows={6}
                    placeholder="Enter the prompt you sent to the model..."
                    value={prompt}
                    onChange={e => setPrompt(e.target.value)}
                    required
                  />
                </div>

                <div>
                  <label className="text-xs text-cyber-dim block mb-1">Model Response</label>
                  <textarea
                    className="textarea"
                    rows={5}
                    placeholder="Paste the model's full response here..."
                    value={response}
                    onChange={e => setResponse(e.target.value)}
                    style={{ color: '#00ff88' }}
                  />
                </div>

                <div>
                  <label className="text-xs text-cyber-dim block mb-1">Analysis Notes</label>
                  <textarea
                    className="textarea"
                    rows={3}
                    placeholder="Observations, indicators of compromise, follow-up ideas..."
                    value={notes}
                    onChange={e => setNotes(e.target.value)}
                  />
                </div>

                <div>
                  <label className="text-xs text-cyber-dim block mb-1">Tags</label>
                  <div className="flex gap-2">
                    <input
                      className="input flex-1 text-xs"
                      placeholder="Add tag and press Enter"
                      value={tagInput}
                      onChange={e => setTagInput(e.target.value)}
                      onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); addTag(); } }}
                    />
                    <button type="button" onClick={addTag} className="btn-secondary">
                      <Tag size={13} />
                    </button>
                  </div>
                  {tags.length > 0 && (
                    <div className="flex gap-1 flex-wrap mt-2">
                      {tags.map(t => (
                        <span key={t} className="badge bg-cyber-muted text-cyber-dim border-0 flex items-center gap-1 text-xs">
                          {t}
                          <button type="button" onClick={() => setTags(ts => ts.filter(x => x !== t))}>
                            <X size={9} className="hover:text-cyber-red" />
                          </button>
                        </span>
                      ))}
                    </div>
                  )}
                </div>

                <div className="flex gap-2 pt-1">
                  <button type="submit" className="btn-primary flex-1">
                    <Save size={15} /> {editingId ? 'Update Entry' : 'Log Entry'}
                  </button>
                  {editingId && (
                    <button type="button" onClick={resetForm} className="btn-secondary">
                      <X size={15} /> Cancel
                    </button>
                  )}
                </div>
              </form>
            </div>
          </div>

          {/* Right: Entry list */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-semibold text-cyber-text">
                Test Log
                {sessEntries.length > 0 && (
                  <span className="ml-2 text-cyber-dim font-normal text-xs">({sessEntries.length} entries)</span>
                )}
              </h2>
              {activeSession && (
                <div className="text-xs text-cyber-dim truncate max-w-[200px]">
                  {activeSession.name}
                </div>
              )}
            </div>

            {sessEntries.length === 0 ? (
              <div className="card text-center py-10">
                <p className="text-xs text-cyber-dim">No entries logged for this session yet.</p>
              </div>
            ) : (
              <div className="space-y-2 max-h-[calc(100vh-220px)] overflow-y-auto pr-1">
                {sessEntries.map(entry => (
                  <EntryCard
                    key={entry.id}
                    entry={entry}
                    onEdit={() => startEdit(entry)}
                    onDelete={() => { if (confirm('Delete this entry?')) deleteEntry(entry.id); }}
                    onPromote={() => openPromote(entry)}
                  />
                ))}
              </div>
            )}
          </div>
        </div>
      ))}

      {/* Library picker modal */}
      {showLibPicker && (
        <div className="fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center z-50 p-4">
          <div className="bg-cyber-card border border-cyber-border rounded-xl w-full max-w-3xl max-h-[85vh] flex flex-col shadow-2xl">
            <div className="flex items-center justify-between p-4 border-b border-cyber-border">
              <h2 className="text-sm font-semibold text-cyber-text">Select from Prompt Library</h2>
              <button onClick={() => setShowLibPicker(false)} className="text-cyber-dim hover:text-cyber-text">
                <X size={18} />
              </button>
            </div>
            <div className="p-4 border-b border-cyber-border flex gap-3">
              <input
                className="input flex-1 text-sm"
                placeholder="Search prompts..."
                value={libSearch}
                onChange={e => setLibSearch(e.target.value)}
                autoFocus
              />
              <select className="select text-xs w-48" value={libCat} onChange={e => setLibCat(e.target.value)}>
                <option value="all">All Categories</option>
                {OWASP_CATS.map(c => <option key={c.id} value={c.id}>{c.id} – {c.name}</option>)}
              </select>
            </div>
            <div className="flex-1 overflow-y-auto p-4 space-y-2">
              {filteredLib.map(p => (
                <div
                  key={p.id}
                  className="p-3 border border-cyber-border rounded-lg hover:border-cyber-blue hover:border-opacity-50 cursor-pointer transition-colors bg-cyber-surface"
                  onClick={() => useLibraryPrompt(p)}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-xs font-medium text-cyber-text">{p.title}</span>
                        <span className={`badge badge-${p.severity}`}>{p.severity}</span>
                        <span className="badge bg-cyber-muted text-cyber-dim border-0 font-mono text-xs">{p.category}</span>
                        <span className="badge bg-cyber-purple bg-opacity-20 text-cyber-purple border-cyber-purple border-opacity-30 text-xs">{p.taxonomy}</span>
                      </div>
                      <p className="text-xs text-cyber-dim mt-1 line-clamp-2">{p.description}</p>
                    </div>
                  </div>
                </div>
              ))}
              {filteredLib.length === 0 && (
                <div className="text-center py-8 text-xs text-cyber-dim">No prompts match your search.</div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Promote to finding modal */}
      {showFindingModal && promoteEntry && (
        <div className="fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center z-50 p-4">
          <div className="bg-cyber-card border border-cyber-border rounded-xl w-full max-w-lg shadow-2xl">
            <div className="flex items-center justify-between p-4 border-b border-cyber-border">
              <h2 className="text-sm font-semibold text-cyber-text">Promote to Finding</h2>
              <button onClick={() => setShowFindingModal(false)} className="text-cyber-dim hover:text-cyber-text">
                <X size={18} />
              </button>
            </div>
            <form onSubmit={submitFinding} className="p-4 space-y-3">
              <div>
                <label className="text-xs text-cyber-dim block mb-1">Finding Title *</label>
                <input className="input" value={findingForm.title} onChange={e => setFindingForm(f => ({ ...f, title: e.target.value }))} required />
              </div>
              <div>
                <label className="text-xs text-cyber-dim block mb-1">Description *</label>
                <textarea className="textarea" rows={3} value={findingForm.description} onChange={e => setFindingForm(f => ({ ...f, description: e.target.value }))} required />
              </div>
              <div>
                <label className="text-xs text-cyber-dim block mb-1">Impact</label>
                <textarea className="textarea" rows={2} placeholder="Business / security impact..." value={findingForm.impact} onChange={e => setFindingForm(f => ({ ...f, impact: e.target.value }))} />
              </div>
              <div>
                <label className="text-xs text-cyber-dim block mb-1">Recommendation</label>
                <textarea className="textarea" rows={2} placeholder="Remediation steps..." value={findingForm.recommendation} onChange={e => setFindingForm(f => ({ ...f, recommendation: e.target.value }))} />
              </div>
              <div>
                <label className="text-xs text-cyber-dim block mb-1">CVSS Score (optional)</label>
                <input className="input" type="number" min="0" max="10" step="0.1" placeholder="0.0 – 10.0" value={findingForm.cvssScore} onChange={e => setFindingForm(f => ({ ...f, cvssScore: e.target.value }))} />
              </div>
              <div className="flex justify-end gap-2 pt-1">
                <button type="button" onClick={() => setShowFindingModal(false)} className="btn-secondary">Cancel</button>
                <button type="submit" className="btn-primary">
                  <AlertTriangle size={14} /> Create Finding
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
