import React, { useState, useMemo } from 'react';
import {
  BookOpen, Copy, Check, Search, Filter, ChevronDown, ChevronUp,
  ExternalLink, Tag, AlertTriangle, Info, Shield,
} from 'lucide-react';
import { PROMPT_LIBRARY, TAXONOMY_DESCRIPTIONS, OWASP_CATEGORIES } from '../data/prompts';
import type { Severity, Taxonomy } from '../types';

const SEV_ORDER: Severity[] = ['critical', 'high', 'medium', 'low', 'info'];

function SeverityBadge({ severity }: { severity: Severity }) {
  return <span className={`badge badge-${severity}`}>{severity}</span>;
}

function TaxonomyBadge({ taxonomy }: { taxonomy: Taxonomy | string }) {
  const cfg = TAXONOMY_DESCRIPTIONS[taxonomy as string];
  const colorMap: Record<string, string> = {
    'OWASP-LLM': 'bg-cyber-orange bg-opacity-20 text-cyber-orange border-cyber-orange',
    APE: 'bg-cyber-purple bg-opacity-20 text-cyber-purple border-cyber-purple',
    Arcanum: 'bg-cyber-blue bg-opacity-20 text-cyber-blue border-cyber-blue',
    'ARC-TEC': 'bg-cyber-blue bg-opacity-20 text-cyber-blue border-cyber-blue',
    'ARC-EVA': 'bg-sky-400 bg-opacity-20 text-sky-400 border-sky-400',
    Custom: 'bg-cyber-green bg-opacity-20 text-cyber-green border-cyber-green',
  };
  const cls = colorMap[taxonomy as string] || 'bg-cyber-muted text-cyber-dim border-cyber-muted';
  return (
    <span className={`badge border border-opacity-30 text-xs ${cls}`}>
      {cfg?.name || taxonomy}
    </span>
  );
}

function PromptCard({ prompt }: { prompt: typeof PROMPT_LIBRARY[0] }) {
  const [expanded, setExpanded] = useState(false);
  const [copied, setCopied] = useState(false);

  function copy() {
    navigator.clipboard.writeText(prompt.prompt);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  return (
    <div className="card hover:border-opacity-60 transition-all">
      {/* Header */}
      <div className="flex items-start gap-3">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-sm font-medium text-cyber-text">{prompt.title}</span>
            <SeverityBadge severity={prompt.severity} />
          </div>
          <div className="flex items-center gap-2 mt-1 flex-wrap">
            <span className="font-mono text-xs text-cyber-blue">{prompt.id}</span>
            <span className="text-cyber-dim text-xs">·</span>
            <span className="text-xs text-cyber-dim">{prompt.technique}</span>
            <span className="text-cyber-dim text-xs">·</span>
            <TaxonomyBadge taxonomy={prompt.taxonomy} />
          </div>
        </div>
        <div className="flex gap-1 flex-shrink-0">
          <button onClick={copy} className="btn-ghost" title="Copy prompt">
            {copied ? <Check size={14} className="text-cyber-green" /> : <Copy size={14} />}
          </button>
          <button onClick={() => setExpanded(e => !e)} className="btn-ghost">
            {expanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
          </button>
        </div>
      </div>

      {/* Preview (always visible) */}
      <p className="text-xs text-cyber-dim mt-2 line-clamp-2">{prompt.description}</p>

      {/* Prompt preview */}
      <div className="mt-2 flex gap-2 items-start">
        <div className="flex-1 min-w-0 bg-cyber-bg border border-cyber-border rounded p-2 font-mono text-xs text-cyber-text line-clamp-2 leading-relaxed">
          {prompt.prompt.slice(0, 200)}{prompt.prompt.length > 200 ? '…' : ''}
        </div>
        <button onClick={copy} className="flex-shrink-0 btn-primary text-xs py-1.5">
          {copied ? <><Check size={12} /> Copied!</> : <><Copy size={12} /> Copy</>}
        </button>
      </div>

      {/* Expanded details */}
      {expanded && (
        <div className="mt-4 space-y-4 border-t border-cyber-border pt-4">
          <div>
            <div className="text-xs font-semibold text-cyber-dim uppercase tracking-wider mb-2">Full Prompt</div>
            <div className="prompt-block text-xs max-h-60 overflow-y-auto whitespace-pre-wrap">{prompt.prompt}</div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <div className="text-xs font-semibold text-cyber-dim uppercase tracking-wider mb-2">Objective</div>
              <p className="text-xs text-cyber-text">{prompt.objective}</p>
            </div>
            <div>
              <div className="text-xs font-semibold text-cyber-dim uppercase tracking-wider mb-2">Category</div>
              <p className="text-xs text-cyber-text font-mono">{prompt.category} — {prompt.categoryName}</p>
              <p className="text-xs text-cyber-dim mt-1">{prompt.subcategory}</p>
            </div>
          </div>

          <div>
            <div className="text-xs font-semibold text-cyber-dim uppercase tracking-wider mb-2">
              Success Indicators
            </div>
            <ul className="space-y-1">
              {prompt.successIndicators.map((ind, i) => (
                <li key={i} className="flex items-start gap-2 text-xs text-cyber-text">
                  <span className="text-cyber-red mt-0.5">▶</span>
                  {ind}
                </li>
              ))}
            </ul>
          </div>

          {prompt.references.length > 0 && (
            <div>
              <div className="text-xs font-semibold text-cyber-dim uppercase tracking-wider mb-2">References</div>
              <div className="space-y-1">
                {prompt.references.map((ref, i) => (
                  <a
                    key={i}
                    href={ref}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-1 text-xs text-cyber-blue hover:underline"
                  >
                    <ExternalLink size={11} /> {ref}
                  </a>
                ))}
              </div>
            </div>
          )}

          <div>
            <div className="text-xs font-semibold text-cyber-dim uppercase tracking-wider mb-2">Tags</div>
            <div className="flex gap-1 flex-wrap">
              {prompt.tags.map(tag => (
                <span key={tag} className="badge bg-cyber-muted text-cyber-dim border-0 text-xs">{tag}</span>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default function PromptLibrary() {
  const [search, setSearch] = useState('');
  const [taxonomy, setTaxonomy] = useState<'all' | Taxonomy>('all');
  const [category, setCategory] = useState('all');
  const [severity, setSeverity] = useState<'all' | Severity>('all');
  const [sortBy, setSortBy] = useState<'id' | 'severity' | 'taxonomy'>('id');
  const [showFilters, setShowFilters] = useState(false);

  const allCategories = useMemo(() => {
    const cats = new Set(PROMPT_LIBRARY.map(p => p.category));
    return Array.from(cats).sort();
  }, []);

  const filtered = useMemo(() => {
    let result = [...PROMPT_LIBRARY];

    if (search) {
      const q = search.toLowerCase();
      result = result.filter(p =>
        p.title.toLowerCase().includes(q) ||
        p.description.toLowerCase().includes(q) ||
        p.technique.toLowerCase().includes(q) ||
        p.prompt.toLowerCase().includes(q) ||
        p.tags.some(t => t.includes(q)) ||
        p.id.toLowerCase().includes(q)
      );
    }
    if (taxonomy !== 'all') result = result.filter(p => p.taxonomy === taxonomy);
    if (category !== 'all') result = result.filter(p => p.category === category);
    if (severity !== 'all') result = result.filter(p => p.severity === severity);

    result.sort((a, b) => {
      if (sortBy === 'severity') return SEV_ORDER.indexOf(a.severity) - SEV_ORDER.indexOf(b.severity);
      if (sortBy === 'taxonomy') return a.taxonomy.localeCompare(b.taxonomy);
      return a.id.localeCompare(b.id);
    });

    return result;
  }, [search, taxonomy, category, severity, sortBy]);

  const countBySev = useMemo(() =>
    SEV_ORDER.reduce((acc, s) => {
      acc[s] = PROMPT_LIBRARY.filter(p => p.severity === s).length;
      return acc;
    }, {} as Record<Severity, number>),
  []);

  return (
    <div className="p-6 max-w-5xl mx-auto space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-xl font-bold text-cyber-text flex items-center gap-2">
          <BookOpen size={22} className="text-cyber-blue" /> Prompt Library
        </h1>
        <p className="text-sm text-cyber-dim mt-1">
          {PROMPT_LIBRARY.length} curated attack prompts from OWASP LLM Top 10, APE Taxonomy, and Arcanum PI Taxonomy.
        </p>
      </div>

      {/* Taxonomy overview cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {Object.entries(TAXONOMY_DESCRIPTIONS).map(([key, desc]) => {
          const count = PROMPT_LIBRARY.filter(p => p.taxonomy === key).length;
          return (
            <button
              key={key}
              onClick={() => setTaxonomy(taxonomy === key ? 'all' : key as Taxonomy)}
              className={`card text-left transition-all ${taxonomy === key ? 'border-opacity-60 glow-blue' : 'hover:border-opacity-50'}`}
              style={{ borderColor: taxonomy === key ? desc.color : undefined }}
            >
              <div className="text-lg font-bold" style={{ color: desc.color }}>{count}</div>
              <div className="text-xs font-medium text-cyber-text mt-0.5">{desc.name}</div>
              <div className="text-xs text-cyber-dim mt-1 line-clamp-2">{desc.description.slice(0, 60)}…</div>
            </button>
          );
        })}
      </div>

      {/* Severity summary */}
      <div className="card">
        <div className="flex items-center justify-between mb-3">
          <span className="card-header mb-0">Coverage by Severity</span>
        </div>
        <div className="flex gap-3 flex-wrap">
          {SEV_ORDER.map(sev => (
            <button
              key={sev}
              onClick={() => setSeverity(severity === sev ? 'all' : sev)}
              className={`flex items-center gap-2 px-3 py-1.5 rounded-lg border transition-all ${
                severity === sev ? `badge-${sev}` : 'border-cyber-border bg-cyber-muted text-cyber-dim hover:border-opacity-60'
              }`}
            >
              <span className={`text-xs font-medium ${severity !== sev ? `badge-${sev}`.includes('critical') ? 'text-cyber-red' : '' : ''}`}>
                {sev.charAt(0).toUpperCase() + sev.slice(1)}
              </span>
              <span className="text-xs font-bold">{countBySev[sev]}</span>
            </button>
          ))}
        </div>
      </div>

      {/* Search & filters */}
      <div className="space-y-3">
        <div className="flex gap-3">
          <div className="relative flex-1">
            <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-cyber-dim" />
            <input
              className="input pl-9"
              placeholder="Search prompts, techniques, tags..."
              value={search}
              onChange={e => setSearch(e.target.value)}
            />
          </div>
          <button
            onClick={() => setShowFilters(f => !f)}
            className={`btn-secondary ${showFilters ? 'border-cyber-blue text-cyber-blue' : ''}`}
          >
            <Filter size={15} /> Filters
          </button>
        </div>

        {showFilters && (
          <div className="card grid grid-cols-2 md:grid-cols-4 gap-3">
            <div>
              <label className="text-xs text-cyber-dim block mb-1">Taxonomy</label>
              <select className="select text-xs" value={taxonomy} onChange={e => setTaxonomy(e.target.value as typeof taxonomy)}>
                <option value="all">All Taxonomies</option>
                <option value="OWASP-LLM">OWASP LLM Top 10</option>
                <option value="APE">APE Taxonomy</option>
                <option value="Arcanum">Arcanum PI</option>
                <option value="Custom">Custom</option>
              </select>
            </div>
            <div>
              <label className="text-xs text-cyber-dim block mb-1">Category</label>
              <select className="select text-xs" value={category} onChange={e => setCategory(e.target.value)}>
                <option value="all">All Categories</option>
                {allCategories.map(c => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>
            <div>
              <label className="text-xs text-cyber-dim block mb-1">Severity</label>
              <select className="select text-xs" value={severity} onChange={e => setSeverity(e.target.value as typeof severity)}>
                <option value="all">All Severities</option>
                {SEV_ORDER.map(s => <option key={s} value={s}>{s.charAt(0).toUpperCase() + s.slice(1)}</option>)}
              </select>
            </div>
            <div>
              <label className="text-xs text-cyber-dim block mb-1">Sort By</label>
              <select className="select text-xs" value={sortBy} onChange={e => setSortBy(e.target.value as typeof sortBy)}>
                <option value="id">ID</option>
                <option value="severity">Severity</option>
                <option value="taxonomy">Taxonomy</option>
              </select>
            </div>
          </div>
        )}

        <div className="flex items-center justify-between">
          <span className="text-xs text-cyber-dim">
            Showing <span className="text-cyber-text font-medium">{filtered.length}</span> of {PROMPT_LIBRARY.length} prompts
          </span>
          {(search || taxonomy !== 'all' || category !== 'all' || severity !== 'all') && (
            <button
              onClick={() => { setSearch(''); setTaxonomy('all'); setCategory('all'); setSeverity('all'); }}
              className="text-xs text-cyber-blue hover:underline"
            >
              Clear filters
            </button>
          )}
        </div>
      </div>

      {/* OWASP reference */}
      <div className="card bg-cyber-bg border-cyber-orange border-opacity-30">
        <div className="flex items-start gap-3">
          <Shield size={16} className="text-cyber-orange mt-0.5 flex-shrink-0" />
          <div>
            <div className="text-xs font-semibold text-cyber-orange mb-1">OWASP LLM Top 10 Reference</div>
            <div className="grid grid-cols-2 md:grid-cols-5 gap-1">
              {Object.entries(OWASP_CATEGORIES).map(([id, cat]) => (
                <button
                  key={id}
                  onClick={() => setCategory(category === id ? 'all' : id)}
                  className={`text-left p-1.5 rounded text-xs transition-colors ${
                    category === id ? 'bg-cyber-orange bg-opacity-20 text-cyber-orange' : 'text-cyber-dim hover:text-cyber-text'
                  }`}
                >
                  <span className="font-mono font-medium">{id}</span>
                  <span className="block text-xs opacity-70 truncate">{cat.name}</span>
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Prompt list */}
      <div className="space-y-3">
        {filtered.length === 0 ? (
          <div className="card text-center py-10">
            <p className="text-sm text-cyber-dim">No prompts match your filters.</p>
          </div>
        ) : (
          filtered.map(p => <PromptCard key={p.id} prompt={p} />)
        )}
      </div>
    </div>
  );
}
