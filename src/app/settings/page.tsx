import { SettingsForm } from '@/components/settings-form';

export default function SettingsPage() {
  return (
    <div style={{ background: 'var(--bg)', minHeight: '100vh' }}>
      <div className="max-w-xl mx-auto px-4 py-8">
        <h1 className="text-lg font-bold mb-1" style={{ color: 'var(--text-primary)' }}>
          Settings
        </h1>
        <p className="text-sm mb-4" style={{ color: 'var(--text-tertiary)' }}>
          Configure your AI provider and customize appearance.
        </p>
        <div className="max-h-[calc(100vh-180px)] overflow-y-auto pr-1">
          <SettingsForm />
        </div>
        <p className="mt-4 text-xs text-center" style={{ color: 'var(--text-tertiary)' }}>
          Your API key is encrypted and stored locally. It never leaves your machine.
        </p>
      </div>
    </div>
  );
}
