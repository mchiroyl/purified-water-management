import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { StatusPanel } from './StatusPanel';

describe('StatusPanel', () => {
  it('marks errors as alerts and other states as status', () => {
    const { rerender } = render(<StatusPanel tone="loading">Cargando…</StatusPanel>);
    expect(screen.getByRole('status')).toHaveTextContent('Cargando…');

    rerender(<StatusPanel tone="error">No fue posible</StatusPanel>);
    expect(screen.getByRole('alert')).toHaveTextContent('No fue posible');
  });
});
