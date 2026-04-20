import '@testing-library/jest-dom';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { NoteIndicator } from '@/components/note-indicator';
import type { Note } from '@/types';

const mockNote: Note = {
  id: 'note-1',
  title: 'Important feature semantics',
  content: 'In the vanilla attention layer, features are projected through the same projection matrices that are shared across all features.',
  tags: ['important'],
  selection: {
    text: 'In the vanilla attention layer...',
    rects: [{ left: 10, top: 20, width: 80, height: 5 }],
    page: 2,
  },
  createdAt: '2024-01-01T00:00:00Z',
  updatedAt: '2024-01-01T00:00:00Z',
};

describe('NoteIndicator', () => {
  it('renders a colored dot with correct tag color', () => {
    render(<NoteIndicator note={mockNote} position={{ x: 100, y: 200 }} onClick={() => {}} />);
    const dot = screen.getByRole('button', { name: /Important feature semantics/ });
    expect(dot).toBeInTheDocument();
    expect(dot).toHaveStyle({ background: 'rgb(239, 68, 68)' });
  });

  it('shows tooltip on hover with note content preview', async () => {
    render(<NoteIndicator note={mockNote} position={{ x: 100, y: 200 }} onClick={() => {}} />);
    const dot = screen.getByRole('button', { name: /Important feature semantics/ });
    fireEvent.mouseEnter(dot);
    const content = await screen.findByText(/In the vanilla attention layer/);
    expect(content).toBeInTheDocument();
    expect(screen.getByText(/重要/)).toBeInTheDocument();
    // Title should NOT appear in tooltip
    expect(screen.queryByText(/Important feature semantics/)).not.toBeInTheDocument();
  });

  it('calls onClick when dot is clicked', () => {
    const handleClick = jest.fn();
    render(<NoteIndicator note={mockNote} position={{ x: 100, y: 200 }} onClick={handleClick} />);
    fireEvent.click(screen.getByRole('button', { name: /Important feature semantics/ }));
    expect(handleClick).toHaveBeenCalledTimes(1);
  });

  it('uses default gray color when note has no tags', () => {
    const noTagNote = { ...mockNote, tags: [] as unknown as typeof mockNote.tags };
    render(<NoteIndicator note={noTagNote} position={{ x: 100, y: 200 }} onClick={() => {}} />);
    const dot = screen.getByRole('button', { name: /Important feature semantics/ });
    expect(dot).toHaveStyle({ background: 'rgb(156, 163, 175)' });
  });
});
