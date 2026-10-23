import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { AccountInfoModal } from './AccountInfoModal';

const me = {
  id: 'user-alice',
  username: 'alice',
  email: 'alice@example.com',
  isOnline: true,
  lastSeenAt: '2026-10-23T10:00:00.000Z',
  createdAt: '2026-10-05T08:30:00.000Z',
  updatedAt: '2026-10-23T10:00:00.000Z',
};

describe('Account info popup', () => {
  it('renders nothing while closed', () => {
    render(<AccountInfoModal user={me} isOpen={false} onClose={vi.fn()} />);
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('shows the username, email and a readable creation date', () => {
    render(<AccountInfoModal user={me} isOpen onClose={vi.fn()} />);
    const dialog = screen.getByRole('dialog', { name: /account info/i });
    expect(dialog).toHaveTextContent('alice');
    expect(dialog).toHaveTextContent('alice@example.com');
    expect(dialog).not.toHaveTextContent('2026-10-05T08:30:00.000Z');
    expect(dialog).toHaveTextContent(new Date(me.createdAt).toLocaleDateString());
  });

  it('stays open when clicking inside, closes on the backdrop, the close button and Escape', () => {
    const onClose = vi.fn();
    render(<AccountInfoModal user={me} isOpen onClose={onClose} />);

    fireEvent.click(screen.getByText('alice@example.com'));
    expect(onClose).not.toHaveBeenCalled();

    fireEvent.click(screen.getByTestId('account-info-modal'));
    fireEvent.click(screen.getByRole('button', { name: /close/i }));
    fireEvent.keyDown(window, { key: 'Escape' });
    expect(onClose).toHaveBeenCalledTimes(3);
  });
});
