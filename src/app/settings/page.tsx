import { SettingsForm } from '@/components/settings-form';

export default function SettingsPage() {
  return (
    <div className="max-w-xl mx-auto px-4 py-8">
      <h1 className="text-2xl font-bold text-gray-800 mb-6">
        API Settings
      </h1>
      <div className="bg-white rounded-lg border p-6">
        <SettingsForm />
      </div>
      <p className="mt-4 text-sm text-gray-400">
        Your API key is encrypted and stored locally. It never leaves your machine.
      </p>
    </div>
  );
}
