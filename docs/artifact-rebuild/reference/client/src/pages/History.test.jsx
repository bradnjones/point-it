import { describe, expect, it, vi, beforeEach } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import History from './History.jsx';

vi.mock('../lib/api.js', () => ({ getSessions: vi.fn() }));
const { getSessions } = await import('../lib/api.js');

beforeEach(() => vi.clearAllMocks());

describe('History', () => {
  it('shows the empty state when there are no sessions', async () => {
    getSessions.mockResolvedValue({ sessions: [], total: 0 });
    render(<History onBack={vi.fn()} />);
    await waitFor(() => expect(screen.getByText(/no sessions yet/i)).toBeInTheDocument());
  });

  it('lists sessions with counts and status', async () => {
    getSessions.mockResolvedValue({
      sessions: [
        {
          id: 2,
          code: 'AAA111',
          name: 'Sprint 42',
          createdAt: '2026-08-01T10:00:00.000Z',
          status: 'active',
          storyCount: 3,
          participantCount: 1,
        },
        {
          id: 1,
          code: 'BBB222',
          name: 'Sprint 41',
          createdAt: '2026-07-01T10:00:00.000Z',
          status: 'closed',
          storyCount: 5,
          participantCount: 4,
        },
      ],
      total: 2,
    });

    render(<History onBack={vi.fn()} />);

    await waitFor(() => expect(screen.getByText('Sprint 42')).toBeInTheDocument());
    expect(screen.getByText('3 stories')).toBeInTheDocument();
    expect(screen.getByText('1 participant')).toBeInTheDocument();
    expect(screen.getByText('4 participants')).toBeInTheDocument();
    expect(screen.getByText('closed')).toBeInTheDocument();
    expect(screen.getByText('active')).toBeInTheDocument();
  });

  it('surfaces a load error', async () => {
    getSessions.mockRejectedValue(new Error('boom'));
    render(<History onBack={vi.fn()} />);
    await waitFor(() => expect(screen.getByText('boom')).toBeInTheDocument());
  });

  it('calls onBack', async () => {
    getSessions.mockResolvedValue({ sessions: [], total: 0 });
    const onBack = vi.fn();
    render(<History onBack={onBack} />);
    await waitFor(() => expect(screen.getByText(/no sessions yet/i)).toBeInTheDocument());
    fireEvent.click(screen.getByRole('button', { name: /back/i }));
    expect(onBack).toHaveBeenCalled();
  });

  it('makes rows clickable when onOpen is provided', async () => {
    getSessions.mockResolvedValue({
      sessions: [
        { id: 1, code: 'AAA111', name: 'S', createdAt: '2026-08-01T10:00:00.000Z', status: 'active', storyCount: 0, participantCount: 1 },
      ],
      total: 1,
    });
    const onOpen = vi.fn();
    render(<History onBack={vi.fn()} onOpen={onOpen} />);
    await waitFor(() => expect(screen.getByText('S')).toBeInTheDocument());
    fireEvent.click(screen.getByRole('button', { name: /S/ }));
    expect(onOpen).toHaveBeenCalledWith('AAA111');
  });
});
