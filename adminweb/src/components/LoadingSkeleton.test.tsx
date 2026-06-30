import { describe, it, expect } from 'vitest';
import { render } from '@testing-library/react';
import LoadingSkeleton, { CardSkeleton, TableSkeleton } from '../components/LoadingSkeleton';

describe('LoadingSkeleton', () => {
  it('renders card skeleton by default', () => {
    const { container } = render(<LoadingSkeleton />);
    expect(container.querySelector('.animate-pulse')).toBeInTheDocument();
  });

  it('renders table skeleton', () => {
    const { container } = render(<LoadingSkeleton type="table" />);
    expect(container.querySelector('.animate-pulse')).toBeInTheDocument();
  });

  it('renders chart skeleton', () => {
    const { container } = render(<LoadingSkeleton type="chart" />);
    expect(container.querySelector('.animate-pulse')).toBeInTheDocument();
  });
});

describe('CardSkeleton', () => {
  it('renders with animation', () => {
    const { container } = render(<CardSkeleton />);
    expect(container.querySelector('.animate-pulse')).toBeInTheDocument();
  });
});

describe('TableSkeleton', () => {
  it('renders with default rows and columns', () => {
    const { container } = render(<TableSkeleton />);
    expect(container.querySelector('.animate-pulse')).toBeInTheDocument();
  });

  it('renders with custom rows and columns', () => {
    const { container } = render(<TableSkeleton rows={3} cols={4} />);
    expect(container.querySelector('.animate-pulse')).toBeInTheDocument();
  });
});
