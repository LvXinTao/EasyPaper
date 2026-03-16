'use client';

interface SectionTabsProps {
  activeSection: string;
  onSectionChange: (section: string) => void;
}

const SECTIONS = [
  { key: 'summary', label: 'Summary' },
  { key: 'contributions', label: 'Contributions' },
  { key: 'methodology', label: 'Methodology' },
  { key: 'experiments', label: 'Experiments' },
  { key: 'conclusions', label: 'Conclusions' },
];

export function SectionTabs({ activeSection, onSectionChange }: SectionTabsProps) {
  return (
    <div className="flex" style={{ borderBottom: '1px solid var(--glass-border)', background: 'var(--surface)' }}>
      {SECTIONS.map(({ key, label }) => (
        <button
          key={key}
          onClick={() => onSectionChange(key)}
          className="px-4 py-2.5 text-sm font-medium transition-all relative"
          style={{ color: activeSection === key ? 'var(--text-primary)' : 'var(--text-tertiary)' }}
        >
          {label}
          {activeSection === key && (
            <span
              className="absolute bottom-0 left-0 right-0 h-0.5 rounded-t"
              style={{ background: 'var(--accent)' }}
            />
          )}
        </button>
      ))}
    </div>
  );
}
