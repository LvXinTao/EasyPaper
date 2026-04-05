import { SettingsForm } from '@/components/settings-form';

export default function SettingsPage() {
  return (
    <div className="h-screen overflow-y-auto">
      <div className="max-w-xl mx-auto px-4 py-10">
        <h1 className="text-2xl font-bold mb-2" style={{ color: 'var(--text-primary)' }}>
          Settings
        </h1>
        <p className="text-sm mb-6" style={{ color: 'var(--text-tertiary)' }}>
          Configure your AI provider and customize appearance.
        </p>
        <SettingsForm />
        <p className="mt-4 text-xs text-center" style={{ color: 'var(--text-tertiary)' }}>
          Your API key is encrypted and stored locally. It never leaves your machine.
        </p>
      </div>
    </div>
  );
}
