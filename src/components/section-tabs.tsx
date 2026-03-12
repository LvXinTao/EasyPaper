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
    <div className="flex border-b">
      {SECTIONS.map(({ key, label }) => (
        <button
          key={key}
          onClick={() => onSectionChange(key)}
          className={`px-4 py-2 text-sm font-medium transition-colors ${
            activeSection === key
              ? 'text-blue-600 border-b-2 border-blue-600'
              : 'text-gray-500 hover:text-gray-700'
          }`}
        >
          {label}
        </button>
      ))}
    </div>
  );
}
