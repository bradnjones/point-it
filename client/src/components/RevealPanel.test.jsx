import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import RevealPanel from './RevealPanel.jsx';

const reveal = {
  storyId: 7,
  roundId: 1,
  votes: [
    { participantId: 1, displayName: 'Alice', value: '3', reason: 'small' },
    { participantId: 2, displayName: 'Bob', value: '8', reason: 'risky' },
  ],
  stats: {
    count: 2,
    numericCount: 2,
    average: 5.5,
    min: 3,
    max: 8,
    spread: 5,
    consensus: false,
    distribution: [
      { value: '3', count: 1 },
      { value: '8', count: 1 },
    ],
  },
};

describe('RevealPanel', () => {
  it('renders nothing when there is no reveal', () => {
    const { container } = render(<RevealPanel reveal={null} />);
    expect(container).toBeEmptyDOMElement();
  });

  it('shows every participant’s value and reason', () => {
    render(<RevealPanel reveal={reveal} />);
    expect(screen.getByText('Alice')).toBeInTheDocument();
    expect(screen.getByText('small')).toBeInTheDocument();
    expect(screen.getByText('Bob')).toBeInTheDocument();
    expect(screen.getByText('risky')).toBeInTheDocument();
  });

  it('summarises the stats', () => {
    render(<RevealPanel reveal={reveal} />);
    expect(screen.getByText('5.5')).toBeInTheDocument();
    expect(screen.getByText('3–8')).toBeInTheDocument();
    expect(screen.queryByText(/consensus/i)).not.toBeInTheDocument();
  });

  it('flags consensus when everyone agreed', () => {
    const agreed = {
      ...reveal,
      stats: { ...reveal.stats, consensus: true, average: 5, min: 5, max: 5, spread: 0 },
    };
    render(<RevealPanel reveal={agreed} />);
    expect(screen.getByText(/consensus/i)).toBeInTheDocument();
  });

  it('hides facilitator actions from non-facilitators', () => {
    render(<RevealPanel reveal={reveal} isFacilitator={false} />);
    expect(screen.queryByRole('button', { name: /re-vote/i })).not.toBeInTheDocument();
    expect(screen.queryByLabelText(/final points/i)).not.toBeInTheDocument();
  });

  it('lets the facilitator finalize with the round’s story id', () => {
    const onFinalize = vi.fn().mockResolvedValue({});
    render(<RevealPanel reveal={reveal} isFacilitator onFinalize={onFinalize} onRevote={vi.fn()} />);

    fireEvent.change(screen.getByLabelText(/final points/i), { target: { value: '5' } });
    fireEvent.click(screen.getByRole('button', { name: /finalize/i }));

    expect(onFinalize).toHaveBeenCalledWith(7, '5');
  });

  it('lets the facilitator trigger a re-vote', () => {
    const onRevote = vi.fn().mockResolvedValue({});
    render(<RevealPanel reveal={reveal} isFacilitator onRevote={onRevote} onFinalize={vi.fn()} />);

    fireEvent.click(screen.getByRole('button', { name: /re-vote/i }));

    expect(onRevote).toHaveBeenCalled();
  });
});
