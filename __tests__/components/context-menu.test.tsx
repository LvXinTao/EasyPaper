// __tests__/components/context-menu.test.tsx
import '@testing-library/jest-dom';
import { render, screen, fireEvent } from '@testing-library/react';
import { ContextMenu } from '@/components/context-menu';

describe('ContextMenu', () => {
  const defaultProps = {
    x: 100,
    y: 100,
    selectedCount: 3,
    onClose: jest.fn(),
    onDelete: jest.fn(),
    onMove: jest.fn(),
    onStar: jest.fn(),
    onUnstar: jest.fn(),
    onClear: jest.fn(),
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('renders all menu items with correct labels', () => {
    render(<ContextMenu {...defaultProps} />);
    expect(screen.getByText('Delete (3)')).toBeInTheDocument();
    expect(screen.getByText('Move to folder...')).toBeInTheDocument();
    expect(screen.getByText('Add star')).toBeInTheDocument();
    expect(screen.getByText('Remove star')).toBeInTheDocument();
    expect(screen.getByText('Clear selection')).toBeInTheDocument();
  });

  it('calls onDelete when delete item clicked', () => {
    const onDelete = jest.fn();
    render(<ContextMenu {...defaultProps} onDelete={onDelete} />);
    fireEvent.click(screen.getByText('Delete (3)'));
    expect(onDelete).toHaveBeenCalledTimes(1);
  });

  it('calls onClose when clicking outside the menu', () => {
    const onClose = jest.fn();
    render(
      <div>
        <div data-testid="outside">Outside</div>
        <ContextMenu {...defaultProps} onClose={onClose} />
      </div>
    );
    fireEvent.mouseDown(screen.getByTestId('outside'));
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('calls onClose when pressing Escape key', () => {
    const onClose = jest.fn();
    render(<ContextMenu {...defaultProps} onClose={onClose} />);
    fireEvent.keyDown(document, { key: 'Escape' });
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('calls onMove and onClose when move item clicked', () => {
    const onMove = jest.fn();
    const onClose = jest.fn();
    render(<ContextMenu {...defaultProps} onMove={onMove} onClose={onClose} />);
    fireEvent.click(screen.getByText('Move to folder...'));
    expect(onMove).toHaveBeenCalledTimes(1);
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('calls onStar and onClose when star item clicked', () => {
    const onStar = jest.fn();
    const onClose = jest.fn();
    render(<ContextMenu {...defaultProps} onStar={onStar} onClose={onClose} />);
    fireEvent.click(screen.getByText('Add star'));
    expect(onStar).toHaveBeenCalledTimes(1);
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('calls onUnstar and onClose when unstar item clicked', () => {
    const onUnstar = jest.fn();
    const onClose = jest.fn();
    render(<ContextMenu {...defaultProps} onUnstar={onUnstar} onClose={onClose} />);
    fireEvent.click(screen.getByText('Remove star'));
    expect(onUnstar).toHaveBeenCalledTimes(1);
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('calls onClear and onClose when clear item clicked', () => {
    const onClear = jest.fn();
    const onClose = jest.fn();
    render(<ContextMenu {...defaultProps} onClear={onClear} onClose={onClose} />);
    fireEvent.click(screen.getByText('Clear selection'));
    expect(onClear).toHaveBeenCalledTimes(1);
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('calls onDelete and onClose when delete item clicked', () => {
    const onDelete = jest.fn();
    const onClose = jest.fn();
    render(<ContextMenu {...defaultProps} onDelete={onDelete} onClose={onClose} />);
    fireEvent.click(screen.getByText('Delete (3)'));
    expect(onDelete).toHaveBeenCalledTimes(1);
    expect(onClose).toHaveBeenCalledTimes(1);
  });
});