import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, act } from '@testing-library/react';
import SearchInput from '../components/SearchInput';

describe('SearchInput', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  it('renders with placeholder', () => {
    render(<SearchInput value="" onChange={() => {}} placeholder="Search users..." />);
    expect(screen.getByPlaceholderText('Search users...')).toBeInTheDocument();
  });

  it('displays initial value', () => {
    render(<SearchInput value="test" onChange={() => {}} />);
    expect(screen.getByDisplayValue('test')).toBeInTheDocument();
  });

  it('calls onChange with debounce', () => {
    const onChange = vi.fn();
    render(<SearchInput value="" onChange={onChange} debounceMs={300} />);
    
    const input = screen.getByRole('textbox');
    fireEvent.change(input, { target: { value: 'hello' } });
    
    expect(onChange).not.toHaveBeenCalled();
    
    act(() => {
      vi.advanceTimersByTime(300);
    });
    
    expect(onChange).toHaveBeenCalledWith('hello');
  });

  it('shows clear button when value is present', () => {
    render(<SearchInput value="test" onChange={() => {}} />);
    expect(screen.getByRole('button')).toBeInTheDocument();
  });

  it('hides clear button when value is empty', () => {
    render(<SearchInput value="" onChange={() => {}} />);
    expect(screen.queryByRole('button')).not.toBeInTheDocument();
  });

  it('clears value when clear button is clicked', () => {
    const onChange = vi.fn();
    render(<SearchInput value="test" onChange={onChange} />);
    
    fireEvent.click(screen.getByRole('button'));
    
    expect(onChange).toHaveBeenCalledWith('');
  });
});
