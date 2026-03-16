import { useState, useEffect } from 'react';
import { X, Edit3, Save, XCircle } from 'lucide-react';

/**
 * PlanningFileViewer — View and edit .planning/ files with atomic save.
 */
export default function PlanningFileViewer({ projectId, filename, onClose, onToast }) {
  const [content, setContent] = useState('');
  const [editedContent, setEditedContent] = useState('');
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    setLoading(true);
    setError(null);
    setEditing(false);
    fetch(`/api/build/projects/${projectId}/files/${filename}`)
      .then(r => {
        if (r.status === 403) throw new Error('This file cannot be edited');
        if (r.status === 404) throw new Error('File not found');
        if (!r.ok) throw new Error('Failed to load file');
        return r.json();
      })
      .then(data => {
        setContent(data.content);
        setEditedContent(data.content);
      })
      .catch(err => setError(err.message))
      .finally(() => setLoading(false));
  }, [projectId, filename]);

  async function handleSave() {
    setSaving(true);
    setError(null);
    try {
      const res = await fetch(`/api/build/projects/${projectId}/files/${filename}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content: editedContent }),
      });
      if (res.status === 403) {
        setError('This file cannot be edited');
        return;
      }
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setError(data.error || 'Save failed');
        return;
      }
      setContent(editedContent);
      setEditing(false);
      onToast?.(`${filename} saved`);
    } catch (err) {
      setError(err.message || 'Save failed');
    } finally {
      setSaving(false);
    }
  }

  function handleCancel() {
    setEditedContent(content);
    setEditing(false);
    setError(null);
  }

  return (
    <div className="glass rounded-xl border border-slate-700/50 overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-2.5 border-b border-slate-700/50">
        <span className="text-sm font-medium text-slate-200 font-mono">{filename}</span>
        <div className="flex items-center gap-2">
          {!editing && !loading && !error && (
            <button
              onClick={() => setEditing(true)}
              className="flex items-center gap-1 text-xs text-slate-400 hover:text-indigo-300 px-2 py-1 rounded hover:bg-indigo-500/10 transition-colors cursor-pointer"
            >
              <Edit3 className="w-3.5 h-3.5" />
              Edit
            </button>
          )}
          {editing && (
            <>
              <button
                onClick={handleSave}
                disabled={saving}
                className="flex items-center gap-1 text-xs text-emerald-400 hover:text-emerald-300 px-2 py-1 rounded hover:bg-emerald-500/10 transition-colors cursor-pointer disabled:opacity-50"
              >
                <Save className="w-3.5 h-3.5" />
                {saving ? 'Saving...' : 'Save'}
              </button>
              <button
                onClick={handleCancel}
                className="flex items-center gap-1 text-xs text-slate-400 hover:text-red-300 px-2 py-1 rounded hover:bg-red-500/10 transition-colors cursor-pointer"
              >
                <XCircle className="w-3.5 h-3.5" />
                Cancel
              </button>
            </>
          )}
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-slate-200 transition-colors cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Content */}
      <div className="p-4">
        {loading && (
          <div className="flex items-center justify-center py-8">
            <span className="text-xs text-slate-500">Loading {filename}...</span>
          </div>
        )}
        {error && (
          <div className="p-3 rounded-lg text-xs bg-red-500/10 border border-red-500/30 text-red-400">
            {error}
          </div>
        )}
        {!loading && !error && (
          <textarea
            value={editing ? editedContent : content}
            onChange={e => editing && setEditedContent(e.target.value)}
            readOnly={!editing}
            className={`w-full font-mono text-sm text-slate-200 bg-slate-900/80 rounded-lg px-4 py-3 outline-none resize-y scrollbar-thin ${
              editing ? 'border border-indigo-500/40 focus:border-indigo-500/60' : 'border border-transparent'
            }`}
            style={{ minHeight: '300px' }}
          />
        )}
      </div>
    </div>
  );
}
