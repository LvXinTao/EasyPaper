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

  it('renders all menu items with correct labels', () => {
    render(<ContextMenu {...defaultProps} />);
    expect(screen.getByText('删除选中项 (3)')).toBeInTheDocument();
    expect(screen.getByText('移动到文件夹...')).toBeInTheDocument();
  });

  it('calls onDelete when delete item clicked', () => {
    const onDelete = jest.fn();
    render(<ContextMenu {...defaultProps} onDelete={onDelete} />);
    fireEvent.click(screen.getByText('删除选中项 (3)'));
    expect(onDelete).toHaveBeenCalledTimes(1);
  });
});
