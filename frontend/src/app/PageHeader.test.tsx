import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { PageHeader } from './PageHeader';

describe('PageHeader', () => {
  it('renders one labelled page heading and optional actions', () => {
    render(
      <PageHeader
        eyebrow="Catálogo"
        title="Productos"
        description="Administra el catálogo"
        actions={<button type="button">Nuevo</button>}
      />
    );

    expect(screen.getByRole('heading', { level: 1, name: 'Productos' })).toBeInTheDocument();
    expect(screen.getByText('Administra el catálogo')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Nuevo' })).toBeInTheDocument();
  });
});
