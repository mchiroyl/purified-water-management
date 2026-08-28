import type { ClipboardEvent, FocusEvent, KeyboardEvent } from 'react';

function pad(value: number): string {
  return String(value).padStart(2, '0');
}

export function currentMonthDateBounds(): { min: string; max: string } {
  const now = new Date();
  const year = now.getFullYear();
  const month = now.getMonth();
  const lastDay = new Date(year, month + 1, 0).getDate();
  return {
    min: `${year}-${pad(month + 1)}-01`,
    max: `${year}-${pad(month + 1)}-${pad(lastDay)}`,
  };
}

export function currentMonthDateTimeBounds(): { min: string; max: string } {
  const bounds = currentMonthDateBounds();
  return { min: `${bounds.min}T00:00`, max: `${bounds.max}T23:59` };
}

export function calendarOnlyProps(): {
  onFocus: (event: FocusEvent<HTMLInputElement>) => void;
  onKeyDown: (event: KeyboardEvent<HTMLInputElement>) => void;
  onPaste: (event: ClipboardEvent<HTMLInputElement>) => void;
} {
  const openCalendar = (input: HTMLInputElement) => {
    if ('showPicker' in input) input.showPicker();
  };
  const focusCalendar = (event: FocusEvent<HTMLInputElement>) => openCalendar(event.currentTarget);
  const blockTyping = (event: KeyboardEvent<HTMLInputElement>) => {
    const navigationKeys = ['Tab', 'Shift', 'ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', 'Home', 'End'];
    if (!navigationKeys.includes(event.key)) {
      event.preventDefault();
      const bounds = currentMonthDateBounds();
      window.alert(`La fecha solo se selecciona desde el calendario. Ejemplo válido: ${bounds.min.slice(8, 10)}/${bounds.min.slice(5, 7)}/${bounds.min.slice(0, 4)}.`);
      openCalendar(event.currentTarget);
    }
  };
  const blockPaste = (event: ClipboardEvent<HTMLInputElement>) => {
    event.preventDefault();
    window.alert('La fecha solo se selecciona desde el calendario. Seleccione una fecha del mes actual.');
    openCalendar(event.currentTarget);
  };
  return { onFocus: focusCalendar, onKeyDown: blockTyping, onPaste: blockPaste };
}
