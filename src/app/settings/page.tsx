import { SettingsForm } from '@/components/settings-form';

export default function SettingsPage() {
  return (
    <div className="max-w-xl mx-auto px-4 py-10">
      <h1 className="text-2xl font-bold text-slate-800 mb-2">
        API Settings
      </h1>
      <p className="text-sm text-slate-400 mb-6">
        Configure your AI provider to enable paper analysis.
      </p>
      <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm">
        <SettingsForm />
      </div>
      <p className="mt-4 text-xs text-slate-400 text-center">
        Your API key is encrypted and stored locally. It never leaves your machine.
      </p>
    </div>
  );
}
