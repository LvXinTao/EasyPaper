import '@testing-library/jest-dom';
import { render, screen, fireEvent, act } from '@testing-library/react';
import { PaperTable } from '@/components/paper-table';
import type { PaperListItem, Folder } from '@/types';

const mockPapers: PaperListItem[] = [
  { id: '1', title: 'Attention Is All You Need', createdAt: '2024-01-01T00:00:00Z', status: 'analyzed', authors: ['Vaswani'], pdfDate: '2017-06-12', shortTitle: 'Attn' },
  { id: '2', title: 'BERT', createdAt: '2024-01-02T00:00:00Z', status: 'pending', authors: ['Devlin', 'Chang'], pdfDate: '2019-05-18' },
  { id: '3', title: 'GPT-3', createdAt: '2024-01-03T00:00:00Z', status: 'error', authors: ['Brown'], pdfDate: '2020-05-28', starred: true },
];

const mockFolders: Folder[] = [{ id: 'f1', name: 'Transformer', parentId: null }];

jest.mock('next/navigation', () => ({ useRouter: () => ({ push: jest.fn() }) }));

const defaultProps = {
  papers: mockPapers,
  folders: mockFolders,
  selectedPaperId: null as string | null,
  selectedPaperIds: new Set<string>(),
  selectedFolderId: null as string | null,
  searchQuery: '',
  statusFilter: 'all' as const,
  starredOnly: false,
  sortMode: 'recent' as const,
  stats: { total: 3, analyzed: 1, pending: 1, error: 1, starred: 1 },
  onPaperClick: jest.fn(),
  onPaperDoubleClick: jest.fn(),
  onCheckboxToggle: jest.fn(),
  onToggleStar: jest.fn(),
  onContextMenuOpen: jest.fn(),
  onSortModeChange: jest.fn(),
  onStatusFilterChange: jest.fn(),
  onStarredOnlyChange: jest.fn(),
  onClearSelection: jest.fn(),
  onShortTitleChange: jest.fn(),
};

describe('PaperTable', () => {
  it('renders table headers', async () => {
    await act(async () => { render(<PaperTable {...defaultProps} />); });
    expect(screen.getByText('Title')).toBeInTheDocument();
    expect(screen.getByText('Author')).toBeInTheDocument();
    expect(screen.getByText('Date')).toBeInTheDocument();
    expect(screen.getByText('Status')).toBeInTheDocument();
    expect(screen.getByText('Short Title')).toBeInTheDocument();
  });

  it('renders paper rows with correct data', async () => {
    await act(async () => { render(<PaperTable {...defaultProps} />); });
    expect(screen.getByText('Attention Is All You Need')).toBeInTheDocument();
    expect(screen.getByText('Vaswani')).toBeInTheDocument();
    // Date column shows formatted pdfDate (Jun 12, 2017)
    expect(screen.getByText(/Jun 12, 2017/)).toBeInTheDocument();
    expect(screen.getByText('Attn')).toBeInTheDocument();
  });

  it('shows et al. for multiple authors', async () => {
    await act(async () => { render(<PaperTable {...defaultProps} />); });
    expect(screen.getByText('Devlin et al.')).toBeInTheDocument();
  });

  it('calls onPaperDoubleClick on row double-click', async () => {
    const onDoubleClick = jest.fn();
    await act(async () => { render(<PaperTable {...defaultProps} onPaperDoubleClick={onDoubleClick} />); });
    const row = screen.getByText('Attention Is All You Need').closest('tr');
    await act(async () => { fireEvent.dblClick(row!); });
    expect(onDoubleClick).toHaveBeenCalledWith('1');
  });

  it('calls onToggleStar on star click', async () => {
    const onToggleStar = jest.fn();
    await act(async () => { render(<PaperTable {...defaultProps} onToggleStar={onToggleStar} />); });
    // Find all star buttons (buttons containing ★ or ☆)
    const allButtons = screen.getAllByRole('button');
    const starButtons = allButtons.filter(btn => btn.textContent === '★' || btn.textContent === '☆');
    // Click the first star button in the table (GPT-3 row, most recent)
    fireEvent.click(starButtons[0]);
    expect(onToggleStar).toHaveBeenCalledWith('3');
  });

  it('highlights selected row', async () => {
    await act(async () => { render(<PaperTable {...defaultProps} selectedPaperId="1" />); });
    const row = screen.getByText('Attention Is All You Need').closest('tr');
    expect(row).toHaveClass('selected');
  });

  it('filters by search query', async () => {
    await act(async () => { render(<PaperTable {...defaultProps} searchQuery="BERT" />); });
    expect(screen.getByText('BERT')).toBeInTheDocument();
    expect(screen.queryByText('Attention Is All You Need')).not.toBeInTheDocument();
  });

  it('sorts by title alphabetically', async () => {
    await act(async () => { render(<PaperTable {...defaultProps} sortMode="name" />); });
    const rows = screen.getAllByRole('row').slice(1); // skip header
    const titles = rows.map(r => r.querySelector('.title-cell')?.textContent);
    expect(titles).toEqual(['Attention Is All You Need', 'BERT', 'GPT-3']);
  });

  it('shows starred papers first when sortMode is starred', async () => {
    await act(async () => { render(<PaperTable {...defaultProps} sortMode="starred" />); });
    const rows = screen.getAllByRole('row').slice(1);
    const firstRow = rows[0].querySelector('.title-cell')?.textContent;
    expect(firstRow).toBe('GPT-3'); // GPT-3 is the only starred paper
  });

  it('calls onCheckboxToggle when checkbox clicked', async () => {
    const onCheckboxToggle = jest.fn();
    await act(async () => { render(<PaperTable {...defaultProps} onCheckboxToggle={onCheckboxToggle} />); });
    // Get checkboxes within the table body (skip header checkbox)
    const checkboxes = screen.getAllByRole('checkbox');
    // First checkbox in tbody is paper 3 (GPT-3, most recent in "recent" sort)
    const firstBodyCheckbox = checkboxes[1];
    fireEvent.click(firstBodyCheckbox);
    expect(onCheckboxToggle).toHaveBeenCalledWith('3');
  });

  it('calls onPaperClick when row clicked', async () => {
    const onPaperClick = jest.fn();
    await act(async () => { render(<PaperTable {...defaultProps} onPaperClick={onPaperClick} />); });
    const row = screen.getByText('Attention Is All You Need').closest('tr');
    fireEvent.click(row!);
    expect(onPaperClick).toHaveBeenCalledWith('1');
  });

  it('calls onContextMenuOpen when row right-clicked', async () => {
    const onContextMenuOpen = jest.fn();
    await act(async () => { render(<PaperTable {...defaultProps} onContextMenuOpen={onContextMenuOpen} />); });
    const row = screen.getByText('Attention Is All You Need').closest('tr');
    fireEvent.contextMenu(row!);
    expect(onContextMenuOpen).toHaveBeenCalled();
  });

  it('shows empty state when no papers match filters', async () => {
    await act(async () => { render(<PaperTable {...defaultProps} searchQuery="nonexistent" />); });
    expect(screen.getByText('No papers match current filters.')).toBeInTheDocument();
  });

  it('shows upload prompt when no papers at all', async () => {
    await act(async () => { render(<PaperTable {...defaultProps} papers={[]} stats={{ total: 0, analyzed: 0, pending: 0, error: 0, starred: 0 }} />); });
    expect(screen.getByText('No papers yet. Upload a PDF to get started.')).toBeInTheDocument();
  });
});
