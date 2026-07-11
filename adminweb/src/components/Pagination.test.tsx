import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import Pagination from '../components/Pagination';

describe('Pagination', () => {
  it('renders nothing when totalPages is 1', () => {
    const { container } = render(
      <Pagination page={1} totalPages={1} total={10} onPageChange={vi.fn()} />
    );
    expect(container.firstChild).toBeNull();
  });

  it('renders prev/next buttons and page numbers', () => {
    render(<Pagination page={3} totalPages={10} total={200} onPageChange={vi.fn()} />);
    expect(screen.getByText('Prev')).toBeInTheDocument();
    expect(screen.getByText('Next')).toBeInTheDocument();
    expect(screen.getByText('200 total')).toBeInTheDocument();
  });

  it('disables Prev on first page', () => {
    render(<Pagination page={1} totalPages={5} total={100} onPageChange={vi.fn()} />);
    expect(screen.getByText('Prev')).toBeDisabled();
  });

  it('disables Next on last page', () => {
    render(<Pagination page={5} totalPages={5} total={100} onPageChange={vi.fn()} />);
    expect(screen.getByText('Next')).toBeDisabled();
  });

  it('calls onPageChange when a page button is clicked', () => {
    const onPageChange = vi.fn();
    render(<Pagination page={3} totalPages={10} total={200} onPageChange={onPageChange} />);
    fireEvent.click(screen.getByText('4'));
    expect(onPageChange).toHaveBeenCalledWith(4);
  });

  it('calls onPageChange with previous page', () => {
    const onPageChange = vi.fn();
    render(<Pagination page={3} totalPages={10} total={200} onPageChange={onPageChange} />);
    fireEvent.click(screen.getByText('Prev'));
    expect(onPageChange).toHaveBeenCalledWith(2);
  });

  it('calls onPageChange with next page', () => {
    const onPageChange = vi.fn();
    render(<Pagination page={3} totalPages={10} total={200} onPageChange={onPageChange} />);
    fireEvent.click(screen.getByText('Next'));
    expect(onPageChange).toHaveBeenCalledWith(4);
  });

  it('highlights the current page', () => {
    render(<Pagination page={2} totalPages={5} total={50} onPageChange={vi.fn()} />);
    const page2Button = screen.getByText('2');
    expect(page2Button.className).toContain('bg-blue-600');
  });

  it('shows ellipsis for large page ranges', () => {
    render(<Pagination page={10} totalPages={20} total={400} onPageChange={vi.fn()} />);
    const ellipses = screen.getAllByText('...');
    expect(ellipses.length).toBeGreaterThanOrEqual(1);
  });

  it('shows first page button when not in initial range', () => {
    render(<Pagination page={10} totalPages={20} total={400} onPageChange={vi.fn()} />);
    expect(screen.getByText('1')).toBeInTheDocument();
  });
});
