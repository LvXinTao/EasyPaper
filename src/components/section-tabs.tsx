'use client';

interface SectionTabsProps {
  activeSection: string;
  onSectionChange: (section: string) => void;
}

const SECTIONS = [
  { key: 'summary', label: 'Summary' },
  { key: 'contributions', label: 'Contributions' },
  { key: 'methodology', label: 'Methodology' },
  { key: 'conclusions', label: 'Conclusions' },
  { key: 'chat', label: 'Q&A' },
];

export function SectionTabs({ activeSection, onSectionChange }: SectionTabsProps) {
  return (
    <div className="flex border-b border-slate-200 bg-white">
      {SECTIONS.map(({ key, label }) => (
        <button
          key={key}
          onClick={() => onSectionChange(key)}
          className={`px-4 py-2.5 text-sm font-medium transition-all relative ${
            activeSection === key
              ? 'text-indigo-600'
              : 'text-slate-400 hover:text-slate-600'
          }`}
        >
          {label}
          {activeSection === key && (
            <span className="absolute bottom-0 left-0 right-0 h-0.5 bg-indigo-500 rounded-t" />
          )}
        </button>
      ))}
    </div>
  );
}
