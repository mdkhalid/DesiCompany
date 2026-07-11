import { describe, it, expect } from 'vitest';
import { render } from '@testing-library/react';
import { ToasterProvider } from '../components/Toast';

describe('ToasterProvider', () => {
  it('renders without crashing', () => {
    const { container } = render(<ToasterProvider />);
    expect(container).toBeInTheDocument();
    expect(container.firstChild).toBeTruthy();
  });

  it('renders a toast container div', () => {
    const { container } = render(<ToasterProvider />);
    expect(container.querySelector('div')).toBeInTheDocument();
  });
});
