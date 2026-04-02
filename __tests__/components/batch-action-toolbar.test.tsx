// __tests__/components/batch-action-toolbar.test.tsx
import '@testing-library/jest-dom';
import { render, screen, fireEvent } from '@testing-library/react';
import { BatchActionToolbar } from '@/components/batch-action-toolbar';

describe('BatchActionToolbar', () => {
  const defaultProps = {
    selectedCount: 3,
    onDelete: jest.fn(),
    onMove: jest.fn(),
    onStar: jest.fn(),
    onClear: jest.fn(),
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('renders nothing when selectedCount is 0', () => {
    render(<BatchActionToolbar {...defaultProps} selectedCount={0} />);
    expect(screen.queryByText(/3 selected/)).not.toBeInTheDocument();
  });

  it('shows selected count', () => {
    render(<BatchActionToolbar {...defaultProps} />);
    expect(screen.getByText(/3 selected/)).toBeInTheDocument();
  });

  it('calls onDelete when delete button clicked', () => {
    const onDelete = jest.fn();
    render(<BatchActionToolbar {...defaultProps} onDelete={onDelete} />);
    fireEvent.click(screen.getByText(/Delete/));
    expect(onDelete).toHaveBeenCalledTimes(1);
  });

  it('calls onMove when move button clicked', () => {
    const onMove = jest.fn();
    render(<BatchActionToolbar {...defaultProps} onMove={onMove} />);
    fireEvent.click(screen.getByText(/Move/));
    expect(onMove).toHaveBeenCalledTimes(1);
  });

  it('calls onStar when star button clicked', () => {
    const onStar = jest.fn();
    render(<BatchActionToolbar {...defaultProps} onStar={onStar} />);
    fireEvent.click(screen.getByText(/Star/));
    expect(onStar).toHaveBeenCalledTimes(1);
  });

  it('calls onClear when clear button clicked', () => {
    const onClear = jest.fn();
    render(<BatchActionToolbar {...defaultProps} onClear={onClear} />);
    fireEvent.click(screen.getByText('Clear'));
    expect(onClear).toHaveBeenCalledTimes(1);
  });

  it('shows singular "1 selected" for single item', () => {
    render(<BatchActionToolbar {...defaultProps} selectedCount={1} />);
    expect(screen.getByText(/1 selected/)).toBeInTheDocument();
  });
});