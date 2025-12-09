/**
 * Unit Tests for M3 Search Bar Component
 * 
 * Tests search bar rendering, expand animation on focus, and search functionality.
 * Requirements: 10.1, 10.3
 */

import * as React from 'react';
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { M3SearchBar, M3SearchResultItem } from './search-bar';

describe('M3SearchBar Component', () => {
  describe('Basic Rendering', () => {
    it('renders with default props', () => {
      render(<M3SearchBar />);
      const input = screen.getByRole('searchbox');
      
      expect(input).toBeInTheDocument();
    });

    it('renders with placeholder text', () => {
      render(<M3SearchBar placeholder="Search tools..." />);
      const input = screen.getByRole('searchbox');
      
      expect(input).toHaveAttribute('placeholder', 'Search tools...');
    });

    it('renders with large corner radius (pill shape)', () => {
      const { container } = render(<M3SearchBar />);
      const searchContainer = container.querySelector('[class*="rounded-"]');
      
      expect(searchContainer).toHaveClass('rounded-[var(--md-sys-shape-corner-full)]');
    });

    it('renders with surface-container-high background', () => {
      const { container } = render(<M3SearchBar />);
      const searchContainer = container.querySelector('[class*="bg-"]');
      
      expect(searchContainer).toHaveClass('bg-[var(--md-sys-color-surface-container-high)]');
    });
  });

  describe('Size Variants', () => {
    it('renders small size correctly', () => {
      const { container } = render(<M3SearchBar size="small" />);
      const searchContainer = container.firstChild?.firstChild;
      
      expect(searchContainer).toHaveClass('h-10');
      expect(searchContainer).toHaveClass('min-w-[200px]');
    });

    it('renders medium size correctly (default)', () => {
      const { container } = render(<M3SearchBar />);
      const searchContainer = container.firstChild?.firstChild;
      
      expect(searchContainer).toHaveClass('h-12');
      expect(searchContainer).toHaveClass('min-w-[280px]');
    });


    it('renders large size correctly', () => {
      const { container } = render(<M3SearchBar size="large" />);
      const searchContainer = container.firstChild?.firstChild;
      
      expect(searchContainer).toHaveClass('h-14');
      expect(searchContainer).toHaveClass('min-w-[360px]');
    });

    it('renders full width when specified', () => {
      const { container } = render(<M3SearchBar fullWidth />);
      const searchContainer = container.firstChild?.firstChild;
      
      expect(searchContainer).toHaveClass('w-full');
    });
  });

  describe('Expand Animation on Focus', () => {
    it('expands search bar when focused', () => {
      const { container } = render(<M3SearchBar size="medium" />);
      const input = screen.getByRole('searchbox');
      const searchContainer = container.firstChild?.firstChild;
      
      fireEvent.focus(input);
      
      // Should expand to larger min-width
      expect(searchContainer).toHaveClass('min-w-[360px]');
    });

    it('adds shadow when focused', () => {
      const { container } = render(<M3SearchBar />);
      const input = screen.getByRole('searchbox');
      const searchContainer = container.firstChild?.firstChild;
      
      fireEvent.focus(input);
      
      expect(searchContainer).toHaveClass('shadow-md');
    });

    it('uses M3 emphasized motion for transitions', () => {
      const { container } = render(<M3SearchBar />);
      const searchContainer = container.firstChild?.firstChild;
      
      expect(searchContainer).toHaveClass('duration-[var(--md-sys-motion-duration-medium2)]');
      expect(searchContainer).toHaveClass('ease-[var(--md-sys-motion-easing-emphasized)]');
    });
  });

  describe('Search Functionality', () => {
    it('displays initial value', () => {
      render(<M3SearchBar value="test query" />);
      const input = screen.getByRole('searchbox');
      
      expect(input).toHaveValue('test query');
    });

    it('calls onChange when value changes', () => {
      const handleChange = vi.fn();
      render(<M3SearchBar onChange={handleChange} />);
      const input = screen.getByRole('searchbox');
      
      fireEvent.change(input, { target: { value: 'new search' } });
      
      expect(handleChange).toHaveBeenCalledWith('new search');
    });

    it('calls onSearch when Enter is pressed', () => {
      const handleSearch = vi.fn();
      render(<M3SearchBar value="search term" onSearch={handleSearch} />);
      const input = screen.getByRole('searchbox');
      
      fireEvent.keyDown(input, { key: 'Enter' });
      
      expect(handleSearch).toHaveBeenCalledWith('search term');
    });

    it('closes on Escape key', () => {
      const { container } = render(<M3SearchBar />);
      const input = screen.getByRole('searchbox');
      
      fireEvent.focus(input);
      fireEvent.keyDown(input, { key: 'Escape' });
      
      // Shadow should be removed when not focused
      const searchContainer = container.firstChild?.firstChild;
      expect(searchContainer).not.toHaveClass('shadow-md');
    });
  });


  describe('Clear Button', () => {
    it('shows clear button when there is text', () => {
      render(<M3SearchBar value="some text" />);
      const clearButton = screen.getByRole('button', { name: /clear/i });
      
      expect(clearButton).toBeInTheDocument();
    });

    it('hides clear button when input is empty', () => {
      render(<M3SearchBar value="" />);
      const clearButton = screen.queryByRole('button', { name: /clear/i });
      
      expect(clearButton).not.toBeInTheDocument();
    });

    it('clears input when clear button is clicked', () => {
      const handleChange = vi.fn();
      render(<M3SearchBar value="text to clear" onChange={handleChange} />);
      const clearButton = screen.getByRole('button', { name: /clear/i });
      
      fireEvent.click(clearButton);
      
      expect(handleChange).toHaveBeenCalledWith('');
    });

    it('calls onClear callback when clear button is clicked', () => {
      const handleClear = vi.fn();
      render(<M3SearchBar value="text" onClear={handleClear} />);
      const clearButton = screen.getByRole('button', { name: /clear/i });
      
      fireEvent.click(clearButton);
      
      expect(handleClear).toHaveBeenCalled();
    });

    it('can hide clear button with showClearButton prop', () => {
      render(<M3SearchBar value="text" showClearButton={false} />);
      const clearButton = screen.queryByRole('button', { name: /clear/i });
      
      expect(clearButton).not.toBeInTheDocument();
    });
  });

  describe('Icons', () => {
    it('renders default search icon', () => {
      const { container } = render(<M3SearchBar />);
      const svg = container.querySelector('svg');
      
      expect(svg).toBeInTheDocument();
    });

    it('renders custom leading icon', () => {
      const CustomIcon = () => <span data-testid="custom-icon">🔍</span>;
      render(<M3SearchBar leadingIcon={<CustomIcon />} />);
      
      expect(screen.getByTestId('custom-icon')).toBeInTheDocument();
    });

    it('renders trailing icon when provided', () => {
      const TrailingIcon = () => <span data-testid="trailing-icon">⚙️</span>;
      render(<M3SearchBar trailingIcon={<TrailingIcon />} />);
      
      expect(screen.getByTestId('trailing-icon')).toBeInTheDocument();
    });
  });

  describe('Dropdown/Results', () => {
    it('shows dropdown when focused with value and children', () => {
      render(
        <M3SearchBar value="test">
          <M3SearchResultItem primary="Result 1" />
        </M3SearchBar>
      );
      const input = screen.getByRole('searchbox');
      
      fireEvent.focus(input);
      
      expect(screen.getByRole('listbox')).toBeInTheDocument();
    });

    it('hides dropdown when no children', () => {
      render(<M3SearchBar value="test" />);
      const input = screen.getByRole('searchbox');
      
      fireEvent.focus(input);
      
      expect(screen.queryByRole('listbox')).not.toBeInTheDocument();
    });

    it('respects dropdownOpen prop', () => {
      render(
        <M3SearchBar value="test" dropdownOpen={true}>
          <M3SearchResultItem primary="Result 1" />
        </M3SearchBar>
      );
      
      expect(screen.getByRole('listbox')).toBeInTheDocument();
    });
  });


  describe('Accessibility', () => {
    it('has searchbox role', () => {
      render(<M3SearchBar />);
      const input = screen.getByRole('searchbox');
      
      expect(input).toBeInTheDocument();
    });

    it('has aria-label from placeholder', () => {
      render(<M3SearchBar placeholder="Search tools" />);
      const input = screen.getByRole('searchbox');
      
      expect(input).toHaveAttribute('aria-label', 'Search tools');
    });

    it('clear button has accessible name', () => {
      render(<M3SearchBar value="text" />);
      const clearButton = screen.getByRole('button', { name: /clear search/i });
      
      expect(clearButton).toBeInTheDocument();
    });
  });

  describe('Focus and Blur Events', () => {
    it('calls onFocus when input is focused', () => {
      const handleFocus = vi.fn();
      render(<M3SearchBar onFocus={handleFocus} />);
      const input = screen.getByRole('searchbox');
      
      fireEvent.focus(input);
      
      expect(handleFocus).toHaveBeenCalled();
    });

    it('calls onBlur when input loses focus', () => {
      const handleBlur = vi.fn();
      render(<M3SearchBar onBlur={handleBlur} />);
      const input = screen.getByRole('searchbox');
      
      fireEvent.focus(input);
      fireEvent.blur(input);
      
      expect(handleBlur).toHaveBeenCalled();
    });
  });
});

describe('M3SearchResultItem Component', () => {
  it('renders primary text', () => {
    render(<M3SearchResultItem primary="Test Result" />);
    
    expect(screen.getByText('Test Result')).toBeInTheDocument();
  });

  it('renders secondary text when provided', () => {
    render(<M3SearchResultItem primary="Result" secondary="Description" />);
    
    expect(screen.getByText('Description')).toBeInTheDocument();
  });

  it('renders icon when provided', () => {
    const Icon = () => <span data-testid="result-icon">📄</span>;
    render(<M3SearchResultItem primary="Result" icon={<Icon />} />);
    
    expect(screen.getByTestId('result-icon')).toBeInTheDocument();
  });

  it('calls onClick when clicked', () => {
    const handleClick = vi.fn();
    render(<M3SearchResultItem primary="Result" onClick={handleClick} />);
    const item = screen.getByRole('option');
    
    fireEvent.click(item);
    
    expect(handleClick).toHaveBeenCalled();
  });

  it('applies highlighted styles when highlighted', () => {
    render(<M3SearchResultItem primary="Result" highlighted />);
    const item = screen.getByRole('option');
    
    expect(item).toHaveClass('bg-[var(--md-sys-color-on-surface)]/[0.08]');
    expect(item).toHaveAttribute('aria-selected', 'true');
  });

  it('has option role for accessibility', () => {
    render(<M3SearchResultItem primary="Result" />);
    const item = screen.getByRole('option');
    
    expect(item).toBeInTheDocument();
  });
});
