'use client';

import { useState, useEffect } from 'react';
import { ThemePicker } from './theme-picker';

interface SettingsData {
  baseUrl: string;
  model: string;
  visionModel: string;
  hasApiKey: boolean;
  embeddingModel: string;
  useSameApiForEmbedding: boolean;
  embeddingBaseUrl: string;
  hasEmbeddingApiKey: boolean;
}

export function SettingsForm() {
  const [settings, setSettings] = useState<SettingsData>({
    baseUrl: 'https://api.openai.com/v1',
    model: 'gpt-4o',
    visionModel: 'gpt-4o',
    hasApiKey: false,
    embeddingModel: 'text-embedding-3-small',
    useSameApiForEmbedding: true,
    embeddingBaseUrl: 'https://api.openai.com/v1',
    hasEmbeddingApiKey: false,
  });
  const [apiKey, setApiKey] = useState('');
  const [embeddingApiKey, setEmbeddingApiKey] = useState('');
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
      const body: Record<string, string | boolean> = {
        baseUrl: settings.baseUrl,
        model: settings.model,
        visionModel: settings.visionModel,
        embeddingModel: settings.embeddingModel,
        useSameApiForEmbedding: settings.useSameApiForEmbedding,
      };
      if (apiKey) {
        body.apiKey = apiKey;
      }
      if (!settings.useSameApiForEmbedding) {
        body.embeddingBaseUrl = settings.embeddingBaseUrl;
        if (embeddingApiKey) {
          body.embeddingApiKey = embeddingApiKey;
        }
      }

      const res = await fetch('/api/settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });

      if (!res.ok) throw new Error('Failed to save settings');

      setMessage({ type: 'success', text: 'Settings saved successfully!' });
      setApiKey('');
      setEmbeddingApiKey('');
      setSettings((prev) => ({
        ...prev,
        hasApiKey: apiKey ? true : prev.hasApiKey,
        hasEmbeddingApiKey: embeddingApiKey ? true : prev.hasEmbeddingApiKey,
      }));
    } catch {
      setMessage({ type: 'error', text: 'Failed to save settings.' });
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-5">
      <div className="mb-6 pb-6" style={{ borderBottom: '1px solid var(--border)' }}>
        <h3 style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text-primary)', marginBottom: '12px' }}>Appearance</h3>
        <ThemePicker />
      </div>

      <div>
        <label style={{ display: 'block', fontSize: '13px', fontWeight: 500, color: 'var(--text-secondary)', marginBottom: '6px' }}>
          Base URL
        </label>
        <input
          type="url"
          value={settings.baseUrl}
          onChange={(e) => setSettings({ ...settings, baseUrl: e.target.value })}
          className="w-full px-4 py-2.5 rounded-xl text-sm focus:outline-none"
          style={{ background: 'var(--glass)', border: '1px solid var(--glass-border)', color: 'var(--text-primary)' }}
          placeholder="https://api.openai.com/v1"
        />
      </div>

      <div>
        <label style={{ display: 'block', fontSize: '13px', fontWeight: 500, color: 'var(--text-secondary)', marginBottom: '6px' }}>
          API Key
          {settings.hasApiKey && (
            <span className="ml-2 text-xs font-normal px-2 py-0.5 rounded-full" style={{ color: 'var(--text-tertiary)', background: 'var(--glass)', border: '1px solid var(--glass-border)' }}>configured</span>
          )}
        </label>
        <input
          type="password"
          value={apiKey}
          onChange={(e) => setApiKey(e.target.value)}
          className="w-full px-4 py-2.5 rounded-xl text-sm focus:outline-none"
          style={{ background: 'var(--glass)', border: '1px solid var(--glass-border)', color: 'var(--text-primary)' }}
          placeholder={settings.hasApiKey ? 'Enter new key to update' : 'sk-xxx'}
        />
      </div>

      <div>
        <label style={{ display: 'block', fontSize: '13px', fontWeight: 500, color: 'var(--text-secondary)', marginBottom: '6px' }}>
          Model
        </label>
        <input
          type="text"
          value={settings.model}
          onChange={(e) => setSettings({ ...settings, model: e.target.value })}
          className="w-full px-4 py-2.5 rounded-xl text-sm focus:outline-none"
          style={{ background: 'var(--glass)', border: '1px solid var(--glass-border)', color: 'var(--text-primary)' }}
          placeholder="gpt-4o"
        />
      </div>

      <div>
        <label style={{ display: 'block', fontSize: '13px', fontWeight: 500, color: 'var(--text-secondary)', marginBottom: '6px' }}>
          Vision Model
        </label>
        <input
          type="text"
          value={settings.visionModel}
          onChange={(e) => setSettings({ ...settings, visionModel: e.target.value })}
          className="w-full px-4 py-2.5 rounded-xl text-sm focus:outline-none"
          style={{ background: 'var(--glass)', border: '1px solid var(--glass-border)', color: 'var(--text-primary)' }}
          placeholder="gpt-4o"
        />
      </div>

      <div style={{ marginTop: '24px', paddingTop: '20px', borderTop: '1px solid var(--border)' }}>
        <h3 style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text-primary)', marginBottom: '16px' }}>
          Embedding Model
        </h3>

        <div className="mb-4">
          <label style={{ display: 'block', fontSize: '13px', fontWeight: 500, color: 'var(--text-secondary)', marginBottom: '6px' }}>
            Embedding Model
          </label>
          <input
            type="text"
            value={settings.embeddingModel}
            onChange={(e) => setSettings({ ...settings, embeddingModel: e.target.value })}
            className="w-full px-4 py-2.5 rounded-xl text-sm focus:outline-none"
            style={{ background: 'var(--glass)', border: '1px solid var(--glass-border)', color: 'var(--text-primary)' }}
            placeholder="text-embedding-3-small"
          />
        </div>

        <div className="mb-4">
          <label
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              fontSize: '13px',
              color: 'var(--text-secondary)',
              cursor: 'pointer',
            }}
          >
            <input
              type="checkbox"
              checked={settings.useSameApiForEmbedding}
              onChange={(e) => setSettings({ ...settings, useSameApiForEmbedding: e.target.checked })}
              className="rounded"
              style={{ accentColor: 'var(--text-primary)' }}
            />
            Use same API service
          </label>
        </div>

        {!settings.useSameApiForEmbedding && (
          <>
            <div className="mb-4">
              <label style={{ display: 'block', fontSize: '13px', fontWeight: 500, color: 'var(--text-secondary)', marginBottom: '6px' }}>
                Embedding Base URL
              </label>
              <input
                type="url"
                value={settings.embeddingBaseUrl}
                onChange={(e) => setSettings({ ...settings, embeddingBaseUrl: e.target.value })}
                className="w-full px-4 py-2.5 rounded-xl text-sm focus:outline-none"
                style={{ background: 'var(--glass)', border: '1px solid var(--glass-border)', color: 'var(--text-primary)' }}
                placeholder="https://api.openai.com/v1"
              />
            </div>

            <div className="mb-2">
              <label style={{ display: 'block', fontSize: '13px', fontWeight: 500, color: 'var(--text-secondary)', marginBottom: '6px' }}>
                Embedding API Key
                {settings.hasEmbeddingApiKey && (
                  <span className="ml-2 text-xs font-normal px-2 py-0.5 rounded-full" style={{ color: 'var(--text-tertiary)', background: 'var(--glass)', border: '1px solid var(--glass-border)' }}>configured</span>
                )}
              </label>
              <input
                type="password"
                value={embeddingApiKey}
                onChange={(e) => setEmbeddingApiKey(e.target.value)}
                className="w-full px-4 py-2.5 rounded-xl text-sm focus:outline-none"
                style={{ background: 'var(--glass)', border: '1px solid var(--glass-border)', color: 'var(--text-primary)' }}
                placeholder={settings.hasEmbeddingApiKey ? 'Enter new key to update' : 'sk-xxx'}
              />
            </div>
          </>
        )}
      </div>

      {message && (
        <div
          className="text-sm font-medium px-4 py-2.5 rounded-xl"
          style={{
            color: message.type === 'success' ? 'var(--text-primary)' : 'var(--rose)',
            background: 'var(--glass)',
            border: '1px solid var(--glass-border)',
          }}
        >
          {message.text}
        </div>
      )}

      <button
        onClick={handleSave}
        disabled={saving}
        className="w-full px-4 py-3 text-sm font-semibold rounded-xl disabled:opacity-50 transition-colors"
        style={{ background: 'var(--text-primary)', color: 'var(--bg)' }}
      >
        {saving ? 'Saving...' : 'Save Settings'}
      </button>
    </div>
  );
}
