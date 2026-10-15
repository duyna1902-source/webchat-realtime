import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor, within } from '@testing-library/react';
import App from './App';

describe('GDG-HUST Auth Screen & Zero-Shift Authentication Flow', () => {
  beforeEach(() => {
    localStorage.clear();
    vi.restoreAllMocks();
  });

  it('renders GDG-HUST branded header with logo, title, and subtitle', () => {
    render(<App />);

    // Primary title and subtitle
    const heading = screen.getByRole('heading', { level: 1, name: /gdg-hust/i });
    expect(heading).toBeInTheDocument();
    expect(
      screen.getByText(/Google Developer Groups on Campus • Hanoi University of Science and Technology/i)
    ).toBeInTheDocument();

    // Sharp GDG brackets logo badge
    const logoImg = screen.getByAltText(/gdg logo/i);
    expect(logoImg).toBeInTheDocument();
    expect(logoImg).toHaveAttribute('src', '/assets/brand/logo-gdg-clean.webp');

    // Solid Google Blue header block (160px)
    const headerBlock = heading.closest('div');
    expect(headerBlock).toHaveClass('bg-google-blue');
    expect(headerBlock).toHaveStyle({ height: '160px' });
  });

  it('renders rigid zero-shift layout with single pill toggle and no bottom toggle link', () => {
    render(<App />);

    // Rigid card container locked to 540px (max 90vh)
    const cardContainer = screen.getByRole('heading', { level: 1, name: /gdg-hust/i }).closest('.auth-card-lock');
    expect(cardContainer).toBeInTheDocument();
    expect(cardContainer).toHaveStyle({ height: '540px', maxHeight: '90vh' });

    // Single pill toggle at the top of the body
    const signInTab = screen.getByRole('tab', { name: /^sign in$/i });
    const createAccountTab = screen.getByRole('tab', { name: /^create account$/i });
    expect(signInTab).toBeInTheDocument();
    expect(createAccountTab).toBeInTheDocument();

    // Redundant bottom toggle text link is completely removed
    expect(screen.queryByText(/already have an account\?/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/don't have an account\?/i)).not.toBeInTheDocument();

    // Rigid form container locked to 275px
    const formContainer = screen.getByTestId('auth-form-container');
    expect(formContainer).toBeInTheDocument();
    expect(formContainer).toHaveStyle({ height: '275px' });

    // In Sign In mode: Sign In submit button is present
    const signInSubmitBtn = screen.getByRole('button', { name: /sign in to gdg-hust/i });
    expect(signInSubmitBtn).toBeInTheDocument();
  });

  it('can toggle between Sign In and Create Account tabs with zero shift', () => {
    render(<App />);

    const signInTab = screen.getByRole('tab', { name: /^sign in$/i });
    const createAccountTab = screen.getByRole('tab', { name: /^create account$/i });

    // Initial state: Sign In is active
    expect(signInTab).toHaveAttribute('aria-selected', 'true');
    expect(createAccountTab).toHaveAttribute('aria-selected', 'false');

    const signInPanel = document.getElementById('panel-signin')!;
    const registerPanel = document.getElementById('panel-register')!;
    expect(signInPanel).not.toHaveClass('hidden');
    expect(registerPanel).toHaveClass('hidden');

    // Switch to Create Account
    fireEvent.click(createAccountTab);

    expect(createAccountTab).toHaveAttribute('aria-selected', 'true');
    expect(signInTab).toHaveAttribute('aria-selected', 'false');
    expect(registerPanel).not.toHaveClass('hidden');
    expect(signInPanel).toHaveClass('hidden');

    // Create Account fields within registerPanel
    expect(within(registerPanel).getByLabelText(/^username$/i)).toBeInTheDocument();
    expect(within(registerPanel).getByLabelText(/email address/i)).toBeInTheDocument();
    expect(within(registerPanel).getByLabelText(/^password$/i)).toBeInTheDocument();

    // Create Account submit button is visible and fully accessible
    const createAccountSubmitBtn = within(registerPanel).getByRole('button', { name: /create gdg-hust account/i });
    expect(createAccountSubmitBtn).toBeInTheDocument();

    // Switch back to Sign In
    fireEvent.click(signInTab);
    expect(signInTab).toHaveAttribute('aria-selected', 'true');
    expect(createAccountTab).toHaveAttribute('aria-selected', 'false');
    expect(signInPanel).not.toHaveClass('hidden');
    expect(registerPanel).toHaveClass('hidden');

    // Redundant bottom link remains completely absent
    expect(screen.queryByText(/already have an account\?/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/don't have an account\?/i)).not.toBeInTheDocument();
  });

  it('submits registration with Create GDG-HUST Account button and logs into Dashboard', async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        token: 'fake-jwt-token-123',
        user: {
          id: 'user-1',
          username: 'alice_client',
          email: 'alice@gdghust.dev',
          isOnline: true,
          lastSeenAt: new Date().toISOString(),
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        },
      }),
    });

    render(<App />);

    // Switch to register tab
    fireEvent.click(screen.getByRole('tab', { name: /^create account$/i }));

    const registerPanel = document.getElementById('panel-register')!;
    fireEvent.change(within(registerPanel).getByLabelText(/^username$/i), { target: { value: 'alice_client' } });
    fireEvent.change(within(registerPanel).getByLabelText(/email address/i), { target: { value: 'alice@gdghust.dev' } });
    fireEvent.change(within(registerPanel).getByLabelText(/^password$/i), { target: { value: 'Secret123!' } });

    fireEvent.click(within(registerPanel).getByRole('button', { name: /create gdg-hust account/i }));

    await waitFor(() => {
      expect(screen.getByText(/welcome, alice_client/i)).toBeInTheDocument();
    });

    expect(localStorage.getItem('webchat_token')).toBe('fake-jwt-token-123');
  });

  it('submits login with Sign In to GDG-HUST button and logs into Dashboard', async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        token: 'fake-jwt-token-login',
        user: {
          id: 'user-2',
          username: 'bob_client',
          email: 'bob@gdghust.dev',
          isOnline: true,
          lastSeenAt: new Date().toISOString(),
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        },
      }),
    });

    render(<App />);

    const signInPanel = document.getElementById('panel-signin')!;
    fireEvent.change(within(signInPanel).getByLabelText(/email or username/i), { target: { value: 'bob_client' } });
    fireEvent.change(within(signInPanel).getByLabelText(/^password$/i), { target: { value: 'Password123!' } });

    fireEvent.click(within(signInPanel).getByRole('button', { name: /sign in to gdg-hust/i }));

    await waitFor(() => {
      expect(screen.getByText(/welcome, bob_client/i)).toBeInTheDocument();
    });

    expect(localStorage.getItem('webchat_token')).toBe('fake-jwt-token-login');
  });

  it('can log out from the dashboard back to GDG-HUST auth screen', async () => {
    localStorage.setItem('webchat_token', 'saved-token');
    localStorage.setItem(
      'webchat_user',
      JSON.stringify({
        id: 'user-3',
        username: 'charlie_client',
        email: 'charlie@gdghust.dev',
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
        email: 'charlie@gdghust.dev',
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
    expect(screen.getByRole('heading', { level: 1, name: /gdg-hust/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /sign in to gdg-hust/i })).toBeInTheDocument();
  });
});
