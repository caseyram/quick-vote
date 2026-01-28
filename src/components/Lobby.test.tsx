import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import Lobby from './Lobby';

describe('Lobby', () => {
  it('renders the session title', () => {
    render(<Lobby title="My Session" />);
    expect(screen.getByText('My Session')).toBeDefined();
  });

  it('shows waiting message', () => {
    render(<Lobby title="Test" />);
    expect(screen.getByText('Waiting for host to start...')).toBeDefined();
  });
});
