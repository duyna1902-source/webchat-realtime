import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import App from './App';

describe('Client Authentication Flow', () => {
  beforeEach(() => {
    localStorage.clear();
    vi.restoreAllMocks();
  });

  it('renders login form by default when not logged in', () => {
    render(<App />);

    expect(screen.getByRole('heading', { name: /sign in/i })).toBeInTheDocument();
    expect(screen.getByLabelText(/email or username/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/password/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /sign in/i })).toBeInTheDocument();
  });

  it('can switch between Login and Register tabs', () => {
    render(<App />);

    const registerTab = screen.getByRole('button', { name: /create account/i });
    fireEvent.click(registerTab);

    expect(screen.getByRole('heading', { name: /create account/i })).toBeInTheDocument();
    expect(screen.getByLabelText(/username/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/email address/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/^password/i)).toBeInTheDocument();

    const loginTab = screen.getByRole('button', { name: /already have an account\? sign in/i });
    fireEvent.click(loginTab);

    expect(screen.getByRole('heading', { name: /sign in/i })).toBeInTheDocument();
  });

  it('submits registration and logs into Dashboard', async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        token: 'fake-jwt-token-123',
        user: {
          id: 'user-1',
          username: 'alice_client',
          email: 'alice@example.com',
          isOnline: true,
          lastSeenAt: new Date().toISOString(),
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        },
      }),
    });

    render(<App />);

    // Switch to register
    fireEvent.click(screen.getByRole('button', { name: /create account/i }));

    fireEvent.change(screen.getByLabelText(/username/i), { target: { value: 'alice_client' } });
    fireEvent.change(screen.getByLabelText(/email address/i), { target: { value: 'alice@example.com' } });
    fireEvent.change(screen.getByLabelText(/^password/i), { target: { value: 'Secret123!' } });

    fireEvent.click(screen.getByRole('button', { name: /sign up/i }));

    await waitFor(() => {
      expect(screen.getByText(/welcome, alice_client/i)).toBeInTheDocument();
    });

    expect(localStorage.getItem('webchat_token')).toBe('fake-jwt-token-123');
  });

  it('submits login and logs into Dashboard', async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        token: 'fake-jwt-token-login',
        user: {
          id: 'user-2',
          username: 'bob_client',
          email: 'bob@example.com',
          isOnline: true,
          lastSeenAt: new Date().toISOString(),
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        },
      }),
    });

    render(<App />);

    fireEvent.change(screen.getByLabelText(/email or username/i), { target: { value: 'bob_client' } });
    fireEvent.change(screen.getByLabelText(/password/i), { target: { value: 'Password123!' } });

    fireEvent.click(screen.getByRole('button', { name: /sign in/i }));

    await waitFor(() => {
      expect(screen.getByText(/welcome, bob_client/i)).toBeInTheDocument();
    });

    expect(localStorage.getItem('webchat_token')).toBe('fake-jwt-token-login');
  });

  it('can log out from the dashboard', async () => {
    localStorage.setItem('webchat_token', 'saved-token');
    localStorage.setItem(
      'webchat_user',
      JSON.stringify({
        id: 'user-3',
        username: 'charlie_client',
        email: 'charlie@example.com',
        isOnline: true,
        lastSeenAt: new Date().toISOString(),
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      })
    );

    // Mock /api/auth/me check
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        id: 'user-3',
        username: 'charlie_client',
        email: 'charlie@example.com',
        isOnline: true,
        lastSeenAt: new Date().toISOString(),
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      }),
    });

    render(<App />);

    await waitFor(() => {
      expect(screen.getByText(/welcome, charlie_client/i)).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole('button', { name: /sign out/i }));

    expect(localStorage.getItem('webchat_token')).toBeNull();
    expect(screen.getByRole('heading', { name: /sign in/i })).toBeInTheDocument();
  });
});
