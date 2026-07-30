import { describe, expect, it, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import App from './App.jsx';

vi.mock('./lib/socket.js', () => ({
  socket: { connected: false, on: vi.fn(), off: vi.fn(), emit: vi.fn() },
  connectSocket: vi.fn(),
  disconnectSocket: vi.fn(),
}));

vi.mock('./lib/api.js', () => ({
  createSession: vi.fn(),
  joinSession: vi.fn(),
  getSession: vi.fn(),
}));

describe('App', () => {
  beforeEach(() => {
    localStorage.clear();
    vi.clearAllMocks();
  });

  it('shows the join screen when there is no stored membership', async () => {
    render(<App />);

    await waitFor(() =>
      expect(screen.getByRole('heading', { name: /point-it/i })).toBeInTheDocument()
    );
    expect(screen.getByLabelText(/your name/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /create session/i })).toBeInTheDocument();
  });

  it('rehydrates into the session view when the stored membership is still valid', async () => {
    const { getSession } = await import('./lib/api.js');
    getSession.mockResolvedValue({
      session: { code: 'ABC123', name: 'Sprint 42' },
      participants: [{ id: 7, displayName: 'Brad', isFacilitator: true, connected: true }],
      stories: [],
    });
    localStorage.setItem(
      'point-it:membership',
      JSON.stringify({ code: 'ABC123', participantId: 7, displayName: 'Brad', isFacilitator: true })
    );

    render(<App />);

    await waitFor(() => expect(screen.getByText(/participants/i)).toBeInTheDocument());
    expect(screen.getByText('ABC123', { exact: false })).toBeInTheDocument();
  });

  it('drops a stale membership and falls back to join', async () => {
    const { getSession } = await import('./lib/api.js');
    getSession.mockRejectedValue(new Error('Session not found'));
    localStorage.setItem(
      'point-it:membership',
      JSON.stringify({ code: 'GONE12', participantId: 1, displayName: 'X' })
    );

    render(<App />);

    await waitFor(() =>
      expect(screen.getByRole('button', { name: /create session/i })).toBeInTheDocument()
    );
    expect(localStorage.getItem('point-it:membership')).toBeNull();
  });
});
