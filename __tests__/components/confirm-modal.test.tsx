import '@testing-library/jest-dom';
import { render, screen, fireEvent } from '@testing-library/react';
import { ConfirmModal } from '@/components/confirm-modal';

describe('ConfirmModal', () => {
  it('renders nothing when isOpen is false', () => {
    render(
      <ConfirmModal
        isOpen={false}
        title="Delete"
        message="Are you sure?"
        confirmLabel="Delete"
        cancelLabel="Cancel"
        onConfirm={jest.fn()}
        onCancel={jest.fn()}
      />
    );
    expect(screen.queryByText('Delete')).not.toBeInTheDocument();
  });

  it('renders modal when isOpen is true', () => {
    render(
      <ConfirmModal
        isOpen={true}
        title="Delete Papers"
        message="Delete 3 papers?"
        confirmLabel="Delete"
        cancelLabel="Cancel"
        onConfirm={jest.fn()}
        onCancel={jest.fn()}
      />
    );
    expect(screen.getByText('Delete Papers')).toBeInTheDocument();
    expect(screen.getByText('Delete 3 papers?')).toBeInTheDocument();
  });

  it('calls onConfirm when confirm button clicked', () => {
    const onConfirm = jest.fn();
    render(
      <ConfirmModal
        isOpen={true}
        title="Test"
        message="Message"
        confirmLabel="OK"
        cancelLabel="Cancel"
        onConfirm={onConfirm}
        onCancel={jest.fn()}
      />
    );
    fireEvent.click(screen.getByRole('button', { name: 'OK' }));
    expect(onConfirm).toHaveBeenCalledTimes(1);
  });

  it('calls onCancel when cancel button or backdrop clicked', () => {
    const onCancel = jest.fn();
    render(
      <ConfirmModal
        isOpen={true}
        title="Test"
        message="Message"
        confirmLabel="OK"
        cancelLabel="Cancel"
        onConfirm={jest.fn()}
        onCancel={onCancel}
      />
    );
    // Click cancel button
    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));
    expect(onCancel).toHaveBeenCalledTimes(1);

    onCancel.mockClear();

    // Click backdrop
    fireEvent.click(screen.getByText('Test').parentElement?.parentElement!);
    expect(onCancel).toHaveBeenCalledTimes(1);
  });

  it('applies danger styling when danger prop is true', () => {
    render(
      <ConfirmModal
        isOpen={true}
        title="Delete"
        message="Are you sure?"
        confirmLabel="Delete"
        cancelLabel="Cancel"
        danger={true}
        onConfirm={jest.fn()}
        onCancel={jest.fn()}
      />
    );
    const confirmButton = screen.getByRole('button', { name: 'Delete' });
    expect(confirmButton).toHaveStyle({ background: 'var(--rose)' });
  });
});
