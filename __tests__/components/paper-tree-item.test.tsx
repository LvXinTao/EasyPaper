// __tests__/components/paper-tree-item.test.tsx
import '@testing-library/jest-dom';
import { render, screen, fireEvent } from '@testing-library/react';
import { PaperTreeItem } from '@/components/paper-tree-item';
import type { PaperListItem } from '@/types';

const mockPaper: PaperListItem = {
  id: 'paper-1',
  title: 'Test Paper Title',
  createdAt: '2024-01-01T00:00:00Z',
  status: 'analyzed',
};

describe('PaperTreeItem', () => {
  const defaultProps = {
    paper: mockPaper,
    isSelected: false,
    isChecked: false,
    depth: 0,
    onClick: jest.fn(),
    onCheckboxToggle: jest.fn(),
    onContextMenu: jest.fn(),
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('renders paper title', () => {
    render(<PaperTreeItem {...defaultProps} />);
    expect(screen.getByText('Test Paper Title')).toBeInTheDocument();
  });

  it('calls onCheckboxToggle when checkbox clicked', () => {
    const onCheckboxToggle = jest.fn();
    render(<PaperTreeItem {...defaultProps} onCheckboxToggle={onCheckboxToggle} />);
    fireEvent.click(screen.getByRole('checkbox'));
    expect(onCheckboxToggle).toHaveBeenCalledTimes(1);
  });

  it('calls onClick when title clicked', () => {
    const onClick = jest.fn();
    render(<PaperTreeItem {...defaultProps} onClick={onClick} />);
    fireEvent.click(screen.getByText('Test Paper Title'));
    expect(onClick).toHaveBeenCalledTimes(1);
  });

  it('shows analyzed status indicator', () => {
    render(<PaperTreeItem {...defaultProps} paper={{ ...mockPaper, status: 'analyzed' }} />);
    expect(screen.getByText('\u2713')).toBeInTheDocument();
  });
});