import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor, within } from '@testing-library/react';
import { AuthScreen } from './AuthScreen';
import { AuthContext } from '../../context/AuthContext';

const turnstileReset = vi.hoisted(() => vi.fn());

// A stand-in widget: "Solve challenge" plays Cloudflare handing the page a token.
vi.mock('@marsidev/react-turnstile', async () => {
  const { forwardRef, useImperativeHandle } = await import('react');
  return {
    Turnstile: forwardRef(
      ({ siteKey, onSuccess }: { siteKey: string; onSuccess?: (token: string) => void }, ref) => {
        useImperativeHandle(ref, () => ({ reset: turnstileReset }));
        return (
          <div data-testid="turnstile" data-sitekey={siteKey}>
            <button type="button" onClick={() => onSuccess?.('solved-token')}>
              Solve challenge
            </button>
          </div>
        );
      }
    ),
  };
});

describe('AuthScreen Component - Variant B Zero-Shift Rebranding', () => {
  let mockLogin: ReturnType<typeof vi.fn>;
  let mockRegister: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    turnstileReset.mockClear();
    mockLogin = vi.fn();
    mockRegister = vi.fn();
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({ turnstileSiteKey: null }),
      })
    );
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  const renderAuthScreen = (authOverrides = {}) => {
    const authValue: any = {
      currentUser: null,

      isLoading: false,
      login: mockLogin,
      register: mockRegister,
      logout: vi.fn(),
      ...authOverrides,
    };

    return render(
      <AuthContext.Provider value={authValue}>
        <AuthScreen />
      </AuthContext.Provider>
    );
  };

  it('renders solid Google Blue header block with 56x56 white badge, GDG logo and official titles', () => {
    renderAuthScreen();

    // 160px solid Google Blue header
    const title = screen.getByRole('heading', { level: 1, name: 'GDG-HUST' });
    expect(title).toBeInTheDocument();

    const subtitle = screen.getByText('Google Developer Groups on Campus • Hanoi University of Science and Technology');
    expect(subtitle).toBeInTheDocument();

    const header = title.closest('div');
    expect(header).toHaveClass('bg-google-blue');
    expect(header).toHaveStyle({ height: '160px' });

    // 56x56 badge (w-14 h-14) with rounded-2xl
    const badge = screen.getByAltText('GDG Logo').closest('div');
    expect(badge).toHaveClass('w-14', 'h-14', 'rounded-2xl', 'bg-white');

    const logoImg = screen.getByAltText('GDG Logo');
    expect(logoImg).toHaveAttribute('src', '/assets/brand/logo-gdg-clean.webp');
  });

  it('loads the public Turnstile site key from the server and renders the widget in registration', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({ turnstileSiteKey: '1x00000000000000000000AA' }),
      })
    );
    renderAuthScreen();

    fireEvent.click(screen.getByRole('tab', { name: /^create account$/i }));

    const registerPanel = document.getElementById('panel-register')!;
    expect(await within(registerPanel).findByTestId('turnstile')).toHaveAttribute(
      'data-sitekey',
      '1x00000000000000000000AA'
    );
    expect(fetch).toHaveBeenCalledWith('/api/auth/config', { credentials: 'same-origin' });
  });

  it('enforces rigid zero-shift dimensions (590px card, 375px form container)', () => {
    renderAuthScreen();

    const card = document.querySelector('.auth-card-lock');
    expect(card).toBeInTheDocument();
    expect(card).toHaveStyle({ height: '590px', maxHeight: '90vh' });

    const formContainer = screen.getByTestId('auth-form-container');
    expect(formContainer).toHaveStyle({ height: '375px' });
  });

  it('contains single rounded pill toggle and removes redundant bottom link', () => {
    renderAuthScreen();

    const tabsContainer = screen.getByRole('tablist');
    expect(tabsContainer).toHaveClass('rounded-full', 'bg-google-grey100', 'h-10');

    const signInTab = screen.getByRole('tab', { name: /^sign in$/i });
    const createAccountTab = screen.getByRole('tab', { name: /^create account$/i });
    expect(signInTab).toBeInTheDocument();
    expect(createAccountTab).toBeInTheDocument();

    // Redundant bottom toggle text link is completely absent
    expect(screen.queryByText(/don't have an account\?/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/already have an account\?/i)).not.toBeInTheDocument();
  });

  it('pins submit buttons to exact bottom of 275px container in both modes', () => {
    renderAuthScreen();

    const signInPanel = document.getElementById('panel-signin')!;
    const registerPanel = document.getElementById('panel-register')!;

    // Both panels are flex-col justify-between filling inset-0
    expect(signInPanel).toHaveClass('absolute', 'inset-0', 'flex', 'flex-col', 'justify-between');
    expect(registerPanel).toHaveClass('absolute', 'inset-0', 'flex', 'flex-col', 'justify-between');

    // Sign in button is pinned at bottom of form
    const signInBtn = within(signInPanel).getByRole('button', { name: /sign in to gdg-hust/i });
    expect(signInBtn).toBeInTheDocument();
    expect(signInBtn).toHaveClass('bg-google-blue', 'rounded-full');

    // Switch to Register
    fireEvent.click(screen.getByRole('tab', { name: /^create account$/i }));

    const registerBtn = within(registerPanel).getByRole('button', { name: /create gdg-hust account/i });
    expect(registerBtn).toBeInTheDocument();
    expect(registerBtn).toHaveClass('bg-google-blue', 'rounded-full');
  });

  it('displays error in sign in panel when credentials are invalid', async () => {
    mockLogin.mockRejectedValue(new Error('Invalid email or password'));
    renderAuthScreen();

    const signInPanel = document.getElementById('panel-signin')!;
    fireEvent.change(within(signInPanel).getByLabelText(/email or username/i), { target: { value: 'user@test.com' } });
    fireEvent.change(within(signInPanel).getByLabelText(/^password$/i), { target: { value: 'wrongpass' } });

    fireEvent.click(within(signInPanel).getByRole('button', { name: /sign in to gdg-hust/i }));

    await waitFor(() => {
      expect(screen.getByRole('alert')).toBeInTheDocument();
      expect(screen.getByText('Invalid email or password')).toBeInTheDocument();
    });

    // Switching to register clears error
    fireEvent.click(screen.getByRole('tab', { name: /^create account$/i }));
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });

  it('shows register validation messages in place, inside the fixed form, without shifting the fields', async () => {
    renderAuthScreen();
    fireEvent.click(screen.getByRole('tab', { name: /^create account$/i }));

    const registerPanel = document.getElementById('panel-register')!;
    const fieldStack = registerPanel.querySelector('form > div')!;
    const rowsBefore = Array.from(fieldStack.children);

    const usernameInput = within(registerPanel).getByLabelText(/^username/i);
    const passwordInput = within(registerPanel).getByLabelText(/^password/i);
    fireEvent.change(usernameInput, { target: { value: 'ab' } });
    fireEvent.change(within(registerPanel).getByLabelText(/^email address/i), { target: { value: 'user@test.com' } });
    fireEvent.change(passwordInput, { target: { value: 'short' } });
    fireEvent.click(within(registerPanel).getByRole('button', { name: /create gdg-hust account/i }));

    expect(mockRegister).not.toHaveBeenCalled();

    // Each message sits in its field's label row, which exists before the error too.
    const usernameHint = await within(registerPanel).findByText('Username must be at least 3 characters');
    expect(usernameInput).toHaveAttribute('aria-invalid', 'true');
    expect(usernameInput).toHaveAccessibleDescription('Username must be at least 3 characters');
    expect(passwordInput).toHaveAccessibleDescription('Password must be at least 8 characters');
    expect(usernameHint.parentElement!.querySelector('label[for="reg-username"]')).not.toBeNull();

    // No row was inserted above or between the fields, and the container keeps its height.
    expect(Array.from(fieldStack.children)).toEqual(rowsBefore);
    expect(screen.getByTestId('auth-form-container')).toHaveStyle({ height: '375px' });

    // Fixing the field clears its message.
    fireEvent.change(usernameInput, { target: { value: 'abc' } });
    expect(within(registerPanel).queryByText('Username must be at least 3 characters')).not.toBeInTheDocument();
    expect(usernameInput).not.toHaveAttribute('aria-invalid', 'true');
  });

  it('submits a registration that passes the shared rules', async () => {
    mockRegister.mockResolvedValue(undefined);
    renderAuthScreen();
    fireEvent.click(screen.getByRole('tab', { name: /^create account$/i }));

    const registerPanel = document.getElementById('panel-register')!;
    fireEvent.change(within(registerPanel).getByLabelText(/^username/i), { target: { value: 'new.user_1' } });
    fireEvent.change(within(registerPanel).getByLabelText(/^email address/i), { target: { value: 'New@Test.com' } });
    fireEvent.change(within(registerPanel).getByLabelText(/^password/i), { target: { value: 'password123' } });
    fireEvent.click(within(registerPanel).getByRole('button', { name: /create gdg-hust account/i }));

    await waitFor(() =>
      expect(mockRegister).toHaveBeenCalledWith({ username: 'new.user_1', email: 'New@Test.com', password: 'password123' })
    );
  });

  it('displays error in register panel when registration fails', async () => {
    mockRegister.mockRejectedValue(new Error('Username already taken'));
    renderAuthScreen();

    fireEvent.click(screen.getByRole('tab', { name: /^create account$/i }));

    const registerPanel = document.getElementById('panel-register')!;
    fireEvent.change(within(registerPanel).getByLabelText(/^username$/i), { target: { value: 'existing_user' } });
    fireEvent.change(within(registerPanel).getByLabelText(/email address/i), { target: { value: 'user@test.com' } });
    fireEvent.change(within(registerPanel).getByLabelText(/^password$/i), { target: { value: 'password123' } });

    fireEvent.click(within(registerPanel).getByRole('button', { name: /create gdg-hust account/i }));

    await waitFor(() => {
      expect(screen.getByRole('alert')).toBeInTheDocument();
      expect(screen.getByText('Username already taken')).toBeInTheDocument();
    });
  });

  describe('with Turnstile enabled', () => {
    beforeEach(() => {
      vi.stubGlobal(
        'fetch',
        vi.fn().mockResolvedValue({
          ok: true,
          json: async () => ({ turnstileSiteKey: '1x00000000000000000000AA' }),
        })
      );
    });

    const fillSignIn = (panel: HTMLElement) => {
      fireEvent.change(within(panel).getByLabelText(/email or username/i), { target: { value: 'alice' } });
      fireEvent.change(within(panel).getByLabelText(/^password$/i), { target: { value: 'Password123!' } });
    };

    it('does not sign in until the check has given a token', async () => {
      renderAuthScreen();
      const signInPanel = document.getElementById('panel-signin')!;
      await within(signInPanel).findByTestId('turnstile');
      fillSignIn(signInPanel);

      fireEvent.click(within(signInPanel).getByRole('button', { name: /sign in to gdg-hust/i }));

      expect(await screen.findByText('Please complete the verification check first.')).toBeInTheDocument();
      expect(mockLogin).not.toHaveBeenCalled();
    });

    it('sends the token with the sign-in, then resets the widget because a token is single-use', async () => {
      mockLogin.mockRejectedValue(new Error('Invalid credentials'));
      renderAuthScreen();
      const signInPanel = document.getElementById('panel-signin')!;
      fireEvent.click(await within(signInPanel).findByRole('button', { name: 'Solve challenge' }));
      fillSignIn(signInPanel);

      fireEvent.click(within(signInPanel).getByRole('button', { name: /sign in to gdg-hust/i }));

      await waitFor(() =>
        expect(mockLogin).toHaveBeenCalledWith({
          emailOrUsername: 'alice',
          password: 'Password123!',
          turnstileToken: 'solved-token',
        })
      );
      await waitFor(() => expect(turnstileReset).toHaveBeenCalledTimes(1));

      // The spent token is gone: a second attempt waits for a new one.
      fireEvent.click(within(signInPanel).getByRole('button', { name: /sign in to gdg-hust/i }));
      expect(await screen.findByText('Please complete the verification check first.')).toBeInTheDocument();
      expect(mockLogin).toHaveBeenCalledTimes(1);
    });

    it('sends the register form its own token', async () => {
      mockRegister.mockResolvedValue(undefined);
      renderAuthScreen();
      fireEvent.click(screen.getByRole('tab', { name: /^create account$/i }));
      const registerPanel = document.getElementById('panel-register')!;
      fireEvent.click(await within(registerPanel).findByRole('button', { name: 'Solve challenge' }));
      fireEvent.change(within(registerPanel).getByLabelText(/^username/i), { target: { value: 'new.user_1' } });
      fireEvent.change(within(registerPanel).getByLabelText(/^email address/i), { target: { value: 'new@test.com' } });
      fireEvent.change(within(registerPanel).getByLabelText(/^password/i), { target: { value: 'password123' } });

      fireEvent.click(within(registerPanel).getByRole('button', { name: /create gdg-hust account/i }));

      await waitFor(() =>
        expect(mockRegister).toHaveBeenCalledWith({
          username: 'new.user_1',
          email: 'new@test.com',
          password: 'password123',
          turnstileToken: 'solved-token',
        })
      );
    });
  });
});
