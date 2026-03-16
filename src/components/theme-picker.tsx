'use client';

import { useState, useEffect } from 'react';
import type { ThemePreset } from '@/types';

const presets: { id: ThemePreset; name: string; preview: string }[] = [
  { id: 'dark-minimal', name: 'Dark Minimal', preview: '#161618' },
  { id: 'light-minimal', name: 'Light Minimal', preview: '#fafafa' },
  { id: 'deep-blue', name: 'Deep Blue', preview: '#0d1117' },
  { id: 'warm-dark', name: 'Warm Dark', preview: '#1a1816' },
];

export function ThemePicker() {
  const [current, setCurrent] = useState<ThemePreset>('dark-minimal');
  const [customAccent, setCustomAccent] = useState<string>('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    const stored = localStorage.getItem('easypaper-theme') as ThemePreset | null;
    if (stored) setCurrent(stored);
    const accent = localStorage.getItem('easypaper-accent');
    if (accent) setCustomAccent(accent);
  }, []);

  const applyTheme = (preset: ThemePreset) => {
    setCurrent(preset);
    document.documentElement.setAttribute('data-theme', preset);
    localStorage.setItem('easypaper-theme', preset);
    // Persist to server — POST only the theme field; server merges it
    fetch('/api/settings', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ theme: { preset, customAccent: customAccent || null } }),
    });
  };

  const applyAccent = (color: string) => {
    setCustomAccent(color);
    if (color) {
      document.documentElement.style.setProperty('--accent', color);
      // Compute subtle variant at 10% opacity
      const r = parseInt(color.slice(1, 3), 16);
      const g = parseInt(color.slice(3, 5), 16);
      const b = parseInt(color.slice(5, 7), 16);
      document.documentElement.style.setProperty('--accent-subtle', `rgba(${r},${g},${b},0.1)`);
      localStorage.setItem('easypaper-accent', color);
    } else {
      document.documentElement.style.removeProperty('--accent');
      document.documentElement.style.removeProperty('--accent-subtle');
      localStorage.removeItem('easypaper-accent');
    }
  };

  return (
    <div className="space-y-4">
      <div>
        <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '8px' }}>
          Theme
        </label>
        <div className="grid grid-cols-2 gap-2">
          {presets.map(p => (
            <button
              key={p.id}
              onClick={() => applyTheme(p.id)}
              className="cursor-pointer rounded-lg flex items-center gap-3 transition-colors"
              style={{
                padding: '10px 12px',
                background: current === p.id ? 'var(--accent-subtle)' : 'var(--glass)',
                border: current === p.id ? '1px solid var(--accent)' : '1px solid var(--glass-border)',
                textAlign: 'left',
              }}
            >
              <div className="rounded-md flex-shrink-0" style={{ width: '24px', height: '24px', background: p.preview, border: '1px solid var(--border-strong)' }} />
              <span style={{ fontSize: '12px', color: 'var(--text-primary)', fontWeight: 500 }}>{p.name}</span>
            </button>
          ))}
        </div>
      </div>

      <div>
        <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '8px' }}>
          Custom Accent Color
        </label>
        <div className="flex items-center gap-3">
          <input
            type="color"
            value={customAccent || '#9d9db5'}
            onChange={(e) => applyAccent(e.target.value)}
            className="cursor-pointer rounded"
            style={{ width: '36px', height: '36px', border: '1px solid var(--border)', background: 'none' }}
          />
          <span style={{ fontSize: '11px', color: 'var(--text-tertiary)' }}>
            {customAccent || 'Using theme default'}
          </span>
          {customAccent && (
            <button onClick={() => applyAccent('')} className="cursor-pointer" style={{ fontSize: '11px', color: 'var(--rose)' }}>
              Reset
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
