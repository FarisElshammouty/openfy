import { useState } from 'react';
import { api } from '../api';

const FIELDS = [
  { value: 'title', label: 'Title' },
  { value: 'artist', label: 'Artist' },
  { value: 'duration', label: 'Duration (seconds)' },
  { value: 'playCount', label: 'Play count' },
  { value: 'addedAt', label: 'Added date' }
];

const OPS_TEXT = [
  { value: 'contains', label: 'contains' },
  { value: 'equals', label: 'equals' }
];

const OPS_NUM = [
  { value: 'gt', label: '>' },
  { value: 'gte', label: '≥' },
  { value: 'lt', label: '<' },
  { value: 'lte', label: '≤' },
  { value: 'equals', label: '=' }
];

const OPS_DATE = [
  { value: 'in_last_days', label: 'in last N days' }
];

function opsFor(field) {
  if (field === 'duration' || field === 'playCount') return OPS_NUM;
  if (field === 'addedAt') return OPS_DATE;
  return OPS_TEXT;
}

export default function SmartPlaylistBuilder({ onCreated, onCancel }) {
  const [name, setName] = useState('My smart playlist');
  const [source, setSource] = useState('liked');
  const [combine, setCombine] = useState('and');
  const [rules, setRules] = useState([{ field: 'artist', op: 'contains', value: '' }]);
  const [sort, setSort] = useState('addedAt');
  const [sortDir, setSortDir] = useState('desc');
  const [limit, setLimit] = useState(100);
  const [saving, setSaving] = useState(false);

  const addRule = () => setRules(r => [...r, { field: 'artist', op: 'contains', value: '' }]);
  const removeRule = (i) => setRules(r => r.filter((_, idx) => idx !== i));
  const updateRule = (i, patch) => setRules(r => r.map((rule, idx) => idx === i ? { ...rule, ...patch } : rule));

  const handleSave = async () => {
    setSaving(true);
    try {
      const result = await api.createSmartPlaylist(name, { source, combine, rules: rules.filter(r => r.value !== ''), sort, sortDir, limit });
      onCreated(result.id);
    } catch (e) {
      alert('Failed: ' + e.message);
    }
    setSaving(false);
  };

  return (
    <div className="bg-neutral-800/40 rounded-lg p-4 max-w-3xl space-y-3">
      <div className="text-sm font-semibold">New smart playlist</div>

      <div className="flex gap-3 items-center">
        <input value={name} onChange={e => setName(e.target.value)}
          placeholder="Name"
          className="flex-1 bg-neutral-900 text-white text-sm px-3 py-2 rounded outline-none focus:ring-2 focus:ring-white/20" />
      </div>

      <div className="flex gap-3 items-center text-sm">
        <span className="text-neutral-400">Match tracks from</span>
        <select value={source} onChange={e => setSource(e.target.value)}
          className="bg-neutral-900 text-white text-sm px-2 py-1.5 rounded outline-none">
          <option value="liked">Liked Songs</option>
          <option value="history">Listening History</option>
          <option value="all">Both</option>
        </select>
        <span className="text-neutral-400">where</span>
        <select value={combine} onChange={e => setCombine(e.target.value)}
          className="bg-neutral-900 text-white text-sm px-2 py-1.5 rounded outline-none">
          <option value="and">all</option>
          <option value="or">any</option>
        </select>
        <span className="text-neutral-400">rules match:</span>
      </div>

      {rules.map((rule, i) => (
        <div key={i} className="flex gap-2 items-center">
          <select value={rule.field} onChange={e => updateRule(i, { field: e.target.value, op: opsFor(e.target.value)[0].value })}
            className="bg-neutral-900 text-white text-sm px-2 py-1.5 rounded outline-none">
            {FIELDS.map(f => <option key={f.value} value={f.value}>{f.label}</option>)}
          </select>
          <select value={rule.op} onChange={e => updateRule(i, { op: e.target.value })}
            className="bg-neutral-900 text-white text-sm px-2 py-1.5 rounded outline-none">
            {opsFor(rule.field).map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
          </select>
          <input value={rule.value} onChange={e => updateRule(i, { value: e.target.value })}
            placeholder="value"
            className="flex-1 bg-neutral-900 text-white text-sm px-3 py-1.5 rounded outline-none focus:ring-1 focus:ring-white/20" />
          {rules.length > 1 && (
            <button onClick={() => removeRule(i)} className="text-neutral-400 hover:text-red-400 p-1">
              <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor"><path d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z" /></svg>
            </button>
          )}
        </div>
      ))}

      <button onClick={addRule} className="text-xs text-green-500 hover:text-green-400 transition-colors">
        + Add rule
      </button>

      <div className="flex gap-3 items-center text-sm">
        <span className="text-neutral-400">Sort by</span>
        <select value={sort} onChange={e => setSort(e.target.value)}
          className="bg-neutral-900 text-white text-sm px-2 py-1.5 rounded outline-none">
          {FIELDS.map(f => <option key={f.value} value={f.value}>{f.label}</option>)}
        </select>
        <select value={sortDir} onChange={e => setSortDir(e.target.value)}
          className="bg-neutral-900 text-white text-sm px-2 py-1.5 rounded outline-none">
          <option value="desc">descending</option>
          <option value="asc">ascending</option>
        </select>
        <span className="text-neutral-400">limit</span>
        <input type="number" min={1} max={500} value={limit} onChange={e => setLimit(+e.target.value || 100)}
          className="w-20 bg-neutral-900 text-white text-sm px-2 py-1.5 rounded outline-none" />
      </div>

      <div className="flex gap-2 pt-2">
        <button onClick={handleSave} disabled={saving || !name.trim()}
          className="bg-green-500 hover:bg-green-400 text-black font-semibold text-sm px-4 py-2 rounded-full disabled:opacity-50">
          {saving ? 'Creating...' : 'Create'}
        </button>
        <button onClick={onCancel}
          className="bg-neutral-700 hover:bg-neutral-600 text-white text-sm px-4 py-2 rounded-full">
          Cancel
        </button>
      </div>
    </div>
  );
}
