'use client';

import { useState, useEffect, useCallback } from 'react';

interface PresetOption {
  label: string;
  content: string;
}

interface PromptConfig {
  preset: string;
  custom: string;
}

interface PromptsData {
  current: { vision: PromptConfig; analysis: PromptConfig; chat: PromptConfig } | null;
  presets: {
    vision: Record<string, PresetOption>;
    analysis: Record<string, PresetOption>;
    chat: Record<string, PresetOption>;
  };
}

function PromptEditor({
  title,
  type,
  config,
  presets,
  onChange,
}: {
  title: string;
  type: 'vision' | 'analysis' | 'chat';
  config: PromptConfig;
  presets: Record<string, PresetOption>;
  onChange: (config: PromptConfig) => void;
}) {
  const [showConfirm, setShowConfirm] = useState<string | null>(null);
  const [showRestoreConfirm, setShowRestoreConfirm] = useState(false);

  const currentPresetContent = presets[config.preset]?.content || '';
  const isModified = config.custom !== currentPresetContent;

  const handlePresetSwitch = (key: string) => {
    if (key === config.preset) return;
    if (isModified) {
      setShowConfirm(key);
    } else {
      onChange({ preset: key, custom: presets[key].content });
    }
  };

  const confirmSwitch = () => {
    if (showConfirm) {
      onChange({ preset: showConfirm, custom: presets[showConfirm].content });
      setShowConfirm(null);
    }
  };

  const restorePreset = () => {
    if (!showRestoreConfirm) {
      setShowRestoreConfirm(true);
      return;
    }
    onChange({ preset: config.preset, custom: currentPresetContent });
    setShowRestoreConfirm(false);
  };

  const requiredPlaceholders = type === 'chat' ? ['{content}', '{history}', '{question}'] : type === 'analysis' ? ['{content}'] : [];
  const missingPlaceholders = requiredPlaceholders.filter(p => !config.custom.includes(p));

  return (
    <div className="rounded-xl" style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}>
      <div className="px-4 py-3 flex items-center justify-between" style={{ borderBottom: '1px solid var(--border)' }}>
        <div>
          <h3 className="text-xs font-semibold" style={{ color: 'var(--text-primary)' }}>{title}</h3>
          {type === 'chat' && (
            <p className="text-xs mt-0.5" style={{ color: 'var(--text-tertiary)', fontSize: '10px' }}>
              Required: {'{content}'}, {'{history}'}, {'{question}'}
            </p>
          )}
          {type === 'analysis' && (
            <p className="text-xs mt-0.5" style={{ color: 'var(--text-tertiary)', fontSize: '10px' }}>
              Required: {'{content}'} &middot; Must return valid JSON
            </p>
          )}
        </div>
        <div className="flex items-center gap-1.5">
          {Object.entries(presets).map(([key, preset]) => (
            <button
              key={key}
              onClick={() => handlePresetSwitch(key)}
              className="px-2.5 py-1 text-xs font-medium rounded-md cursor-pointer transition-colors"
              style={
                config.preset === key
                  ? { background: 'var(--accent)', color: 'var(--bg)', fontSize: '11px' }
                  : { background: 'var(--glass)', color: 'var(--text-secondary)', border: '1px solid var(--glass-border)', fontSize: '11px' }
              }
            >
              {preset.label}
            </button>
          ))}
          {isModified && (
            <span className="text-xs" style={{ color: 'var(--accent)', fontSize: '10px' }}>(modified)</span>
          )}
        </div>
      </div>

      {showConfirm && (
        <div className="px-4 py-2 flex items-center justify-between" style={{ background: 'color-mix(in srgb, var(--accent) 10%, transparent)', borderBottom: '1px solid var(--border)' }}>
          <span className="text-xs" style={{ color: 'var(--text-secondary)' }}>
            Switching preset will replace your customizations. Continue?
          </span>
          <div className="flex gap-2">
            <button onClick={() => setShowConfirm(null)} className="px-2 py-0.5 text-xs cursor-pointer" style={{ color: 'var(--text-tertiary)' }}>Cancel</button>
            <button onClick={confirmSwitch} className="px-2 py-0.5 text-xs font-medium rounded-md cursor-pointer" style={{ background: 'var(--accent)', color: 'var(--bg)' }}>Continue</button>
          </div>
        </div>
      )}

      <div className="p-4">
        <textarea
          value={config.custom}
          onChange={(e) => onChange({ ...config, custom: e.target.value })}
          className="w-full font-mono text-xs leading-relaxed rounded-lg resize-y"
          style={{
            minHeight: '160px',
            padding: '10px',
            background: 'var(--bg)',
            color: 'var(--text-primary)',
            border: '1px solid var(--glass-border)',
            outline: 'none',
            fontSize: '11px',
          }}
        />
        {missingPlaceholders.length > 0 && (
          <p className="mt-1.5 text-xs" style={{ color: 'var(--warning, #eab308)', fontSize: '10px' }}>
            Missing placeholders: {missingPlaceholders.join(', ')}
          </p>
        )}
      </div>

      <div className="px-4 py-2 flex justify-end" style={{ borderTop: '1px solid var(--border)' }}>
        <button
          onClick={restorePreset}
          disabled={!isModified}
          className="px-3 py-1 text-xs font-medium rounded-md cursor-pointer transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
          style={{ background: 'var(--glass)', color: 'var(--text-secondary)', border: '1px solid var(--glass-border)', fontSize: '11px' }}
        >
          Restore Preset
        </button>
      </div>
    </div>
  );
}

export function PromptsForm() {
  const [data, setData] = useState<PromptsData | null>(null);
  const [vision, setVision] = useState<PromptConfig | null>(null);
  const [analysis, setAnalysis] = useState<PromptConfig | null>(null);
  const [chat, setChat] = useState<PromptConfig | null>(null);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [savedVision, setSavedVision] = useState<PromptConfig | null>(null);
  const [savedAnalysis, setSavedAnalysis] = useState<PromptConfig | null>(null);
  const [savedChat, setSavedChat] = useState<PromptConfig | null>(null);

  const hasUnsavedChanges = (vision && savedVision && (vision.custom !== savedVision.custom || vision.preset !== savedVision.preset))
    || (analysis && savedAnalysis && (analysis.custom !== savedAnalysis.custom || analysis.preset !== savedAnalysis.preset))
    || (chat && savedChat && (chat.custom !== savedChat.custom || chat.preset !== savedChat.preset));

  useEffect(() => {
    fetch('/api/prompts')
      .then(r => r.json())
      .then((d: PromptsData) => {
        setData(d);
        const v = d.current?.vision || { preset: 'en', custom: d.presets.vision.en.content };
        const a = d.current?.analysis || { preset: 'en', custom: d.presets.analysis.en.content };
        const c = d.current?.chat || { preset: 'en', custom: d.presets.chat.en.content };
        setVision(v);
        setAnalysis(a);
        setChat(c);
        setSavedVision(v);
        setSavedAnalysis(a);
        setSavedChat(c);
      });
  }, []);

  const handleSave = useCallback(async () => {
    if (!vision || !analysis || !chat) return;
    setSaving(true);
    setMessage(null);
    try {
      const res = await fetch('/api/prompts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ vision, analysis, chat }),
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || 'Save failed');
      }
      setMessage({ type: 'success', text: 'Prompts saved successfully' });
      setSavedVision({ ...vision });
      setSavedAnalysis({ ...analysis });
      setSavedChat({ ...chat });
    } catch (err) {
      setMessage({ type: 'error', text: err instanceof Error ? err.message : 'Save failed' });
    } finally {
      setSaving(false);
    }
  }, [vision, analysis, chat]);

  if (!data || !vision || !analysis || !chat) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="animate-spin w-5 h-5 border-2 border-t-transparent rounded-full" style={{ borderColor: 'var(--accent)', borderTopColor: 'transparent' }} />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <PromptEditor
        title="Vision Model Prompt"
        type="vision"
        config={vision}
        presets={data.presets.vision}
        onChange={setVision}
      />
      <PromptEditor
        title="Analysis Prompt"
        type="analysis"
        config={analysis}
        presets={data.presets.analysis}
        onChange={setAnalysis}
      />
      <PromptEditor
        title="Chat Prompt"
        type="chat"
        config={chat}
        presets={data.presets.chat}
        onChange={setChat}
      />

      <div className="flex items-center justify-between pt-2">
        <div className="flex items-center gap-3">
          {message && (
            <span className="text-xs" style={{ color: message.type === 'success' ? 'var(--green, #22c55e)' : 'var(--red, #ef4444)' }}>
              {message.text}
            </span>
          )}
          {hasUnsavedChanges && !message && (
            <span className="flex items-center gap-1.5 text-xs" style={{ color: 'var(--accent)' }}>
              <span className="w-1.5 h-1.5 rounded-full" style={{ background: 'var(--accent)' }} />
              Unsaved changes
            </span>
          )}
        </div>
        <button
          onClick={handleSave}
          disabled={saving}
          className="px-5 py-2 text-xs font-medium rounded-lg cursor-pointer transition-colors disabled:opacity-50"
          style={{ background: 'var(--text-primary)', color: 'var(--bg)' }}
        >
          {saving ? 'Saving...' : 'Save Prompts'}
        </button>
      </div>
    </div>
  );
}
