// __tests__/components/folder-picker-modal.test.tsx
import '@testing-library/jest-dom';
import { render, screen, fireEvent } from '@testing-library/react';
import { FolderPickerModal } from '@/components/folder-picker-modal';
import type { Folder } from '@/types';

const mockFolders: Folder[] = [
  { id: 'f_1', name: 'Folder 1', parentId: null },
  { id: 'f_2', name: 'Folder 2', parentId: null },
  { id: 'f_3', name: 'Subfolder', parentId: 'f_1' },
];

describe('FolderPickerModal', () => {
  const defaultProps = {
    isOpen: true,
    folders: mockFolders,
    selectedFolderId: null,
    onSelect: jest.fn(),
    onCancel: jest.fn(),
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('renders nothing when closed', () => {
    render(<FolderPickerModal {...defaultProps} isOpen={false} />);
    expect(screen.queryByText(/Move to Folder/)).not.toBeInTheDocument();
  });

  it('renders modal with folders when open', () => {
    render(<FolderPickerModal {...defaultProps} />);
    expect(screen.getByText(/Move to Folder/)).toBeInTheDocument();
    expect(screen.getByText(/Folder 1/)).toBeInTheDocument();
    expect(screen.getByText(/Folder 2/)).toBeInTheDocument();
  });

  it('shows root folder option', () => {
    render(<FolderPickerModal {...defaultProps} />);
    expect(screen.getByText(/Root/)).toBeInTheDocument();
  });

  it('calls onCancel when cancel button clicked', () => {
    const onCancel = jest.fn();
    render(<FolderPickerModal {...defaultProps} onCancel={onCancel} />);
    fireEvent.click(screen.getByText('Cancel'));
    expect(onCancel).toHaveBeenCalledTimes(1);
  });

  it('calls onSelect with null when root is selected', () => {
    const onSelect = jest.fn();
    render(<FolderPickerModal {...defaultProps} onSelect={onSelect} />);
    fireEvent.click(screen.getByText(/Root/));
    expect(onSelect).toHaveBeenCalledWith(null);
  });

  it('calls onSelect with folder id when folder is clicked', () => {
    const onSelect = jest.fn();
    render(<FolderPickerModal {...defaultProps} onSelect={onSelect} />);
    fireEvent.click(screen.getByText(/Folder 1/));
    expect(onSelect).toHaveBeenCalledWith('f_1');
  });
});