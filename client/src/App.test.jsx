import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import App from './App.jsx';

// Stub the socket so tests don't open a real connection.
vi.mock('./lib/socket.js', () => ({
  socket: { connected: false, on: vi.fn(), off: vi.fn(), connect: vi.fn() },
  connectSocket: vi.fn(),
  disconnectSocket: vi.fn(),
}));

describe('App', () => {
  it('renders the join screen', () => {
    render(<App />);

    expect(screen.getByRole('heading', { name: /point-it/i })).toBeInTheDocument();
    expect(screen.getByLabelText(/your name/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/session code/i)).toBeInTheDocument();
  });
});
