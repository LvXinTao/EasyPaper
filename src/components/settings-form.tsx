'use client';

import { useState, useEffect } from 'react';

interface SettingsData {
  baseUrl: string;
  model: string;
  visionModel: string;
  hasApiKey: boolean;
}

export function SettingsForm() {
  const [settings, setSettings] = useState<SettingsData>({
    baseUrl: 'https://api.openai.com/v1',
    model: 'gpt-4o',
    visionModel: 'gpt-4o',
    hasApiKey: false,
  });
  const [apiKey, setApiKey] = useState('');
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  useEffect(() => {
    async function loadSettings() {
      try {
        const res = await fetch('/api/settings');
        const data = await res.json();
        setSettings(data);
      } catch {
        // Use defaults
      }
    }
    loadSettings();
  }, []);

  const handleSave = async () => {
    setSaving(true);
    setMessage(null);

    try {
      const body: Record<string, string> = {
        baseUrl: settings.baseUrl,
        model: settings.model,
        visionModel: settings.visionModel,
      };
      if (apiKey) {
        body.apiKey = apiKey;
      }

      const res = await fetch('/api/settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });

      if (!res.ok) throw new Error('Failed to save settings');

      setMessage({ type: 'success', text: 'Settings saved successfully!' });
      setApiKey('');
      setSettings((prev) => ({ ...prev, hasApiKey: true }));
    } catch {
      setMessage({ type: 'error', text: 'Failed to save settings.' });
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-5">
      <div>
        <label className="block text-sm font-medium text-slate-700 mb-1.5">
          Base URL
        </label>
        <input
          type="url"
          value={settings.baseUrl}
          onChange={(e) => setSettings({ ...settings, baseUrl: e.target.value })}
          className="w-full px-4 py-2.5 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-300 focus:border-indigo-300 bg-slate-50"
          placeholder="https://api.openai.com/v1"
        />
      </div>

      <div>
        <label className="block text-sm font-medium text-slate-700 mb-1.5">
          API Key
          {settings.hasApiKey && (
            <span className="ml-2 text-xs text-emerald-600 font-normal bg-emerald-50 px-2 py-0.5 rounded-full">configured</span>
          )}
        </label>
        <input
          type="password"
          value={apiKey}
          onChange={(e) => setApiKey(e.target.value)}
          className="w-full px-4 py-2.5 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-300 focus:border-indigo-300 bg-slate-50"
          placeholder={settings.hasApiKey ? 'Enter new key to update' : 'sk-xxx'}
        />
      </div>

      <div>
        <label className="block text-sm font-medium text-slate-700 mb-1.5">
          Model
        </label>
        <input
          type="text"
          value={settings.model}
          onChange={(e) => setSettings({ ...settings, model: e.target.value })}
          className="w-full px-4 py-2.5 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-300 focus:border-indigo-300 bg-slate-50"
          placeholder="gpt-4o"
        />
      </div>

      <div>
        <label className="block text-sm font-medium text-slate-700 mb-1.5">
          Vision Model
        </label>
        <input
          type="text"
          value={settings.visionModel}
          onChange={(e) => setSettings({ ...settings, visionModel: e.target.value })}
          className="w-full px-4 py-2.5 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-300 focus:border-indigo-300 bg-slate-50"
          placeholder="gpt-4o"
        />
      </div>

      {message && (
        <div
          className={`text-sm font-medium px-4 py-2.5 rounded-xl ${
            message.type === 'success'
              ? 'text-emerald-700 bg-emerald-50 border border-emerald-200'
              : 'text-rose-700 bg-rose-50 border border-rose-200'
          }`}
        >
          {message.text}
        </div>
      )}

      <button
        onClick={handleSave}
        disabled={saving}
        className="w-full px-4 py-3 bg-indigo-500 text-white text-sm font-semibold rounded-xl hover:bg-indigo-600 disabled:opacity-50 transition-colors shadow-sm"
      >
        {saving ? 'Saving...' : 'Save Settings'}
      </button>
    </div>
  );
}
