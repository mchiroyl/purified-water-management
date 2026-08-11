import { act, fireEvent, render, screen } from '@testing-library/react';
import { vi } from 'vitest';

const updateServiceWorker = vi.fn();
vi.mock('virtual:pwa-register/react', () => ({
  useRegisterSW: () => ({
    offlineReady: [true, vi.fn()],
    needRefresh: [true, vi.fn()],
    updateServiceWorker
  })
}));

import { PwaLifecycle } from './PwaLifecycle';

describe('PwaLifecycle', () => {
  it('informa disponibilidad offline y solicita confirmación antes de actualizar', () => {
    render(<PwaLifecycle />);

    expect(screen.getByText(/lista para trabajar sin conexión/i)).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /actualizar ahora/i }));
    expect(updateServiceWorker).toHaveBeenCalledWith(true);
  });

  it('ofrece instalación cuando el navegador emite el evento instalable', () => {
    const prompt = vi.fn(() => Promise.resolve());
    const event = new Event('beforeinstallprompt');
    Object.assign(event, { prompt, userChoice: Promise.resolve({ outcome: 'accepted' }) });
    render(<PwaLifecycle />);

    act(() => window.dispatchEvent(event));
    fireEvent.click(screen.getByRole('button', { name: /instalar aplicación/i }));
    expect(prompt).toHaveBeenCalledOnce();
  });
});
