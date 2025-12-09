/**
 * Unit Tests for M3 Chip Component
 * 
 * Tests all variant renderings, selected states, and interaction behaviors.
 * Requirements: 4.7
 */

import * as React from 'react';
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent, act } from '@testing-library/react';
import { M3Chip } from './chip';

// Mock for testing ripple effect timing
vi.useFakeTimers();

describe('M3Chip Component', () => {
  describe('Variant Renderings', () => {
    it('renders assist variant with correct styles', () => {
      render(<M3Chip variant="assist">Assist Chip</M3Chip>);
      const chip = screen.getByRole('button', { name: /assist chip/i });
      
      expect(chip).toBeInTheDocument();
      expect(chip).toHaveClass('text-[var(--md-sys-color-on-surface)]');
      expect(chip).toHaveClass('border');
      expect(chip).toHaveClass('border-[var(--md-sys-color-outline)]');
    });

    it('renders filter variant with correct styles', () => {
      render(<M3Chip variant="filter">Filter Chip</M3Chip>);
      const chip = screen.getByRole('button', { name: /filter chip/i });
      
      expect(chip).toBeInTheDocument();
      expect(chip).toHaveClass('text-[var(--md-sys-color-on-surface-variant)]');
      expect(chip).toHaveClass('border');
    });

    it('renders input variant with correct styles', () => {
      render(<M3Chip variant="input">Input Chip</M3Chip>);
      const chip = screen.getByRole('button', { name: /input chip/i });
      
      expect(chip).toBeInTheDocument();
      expect(chip).toHaveClass('text-[var(--md-sys-color-on-surface-variant)]');
      expect(chip).toHaveClass('border');
    });

    it('renders suggestion variant with correct styles', () => {
      render(<M3Chip variant="suggestion">Suggestion Chip</M3Chip>);
      const chip = screen.getByRole('button', { name: /suggestion chip/i });
      
      expect(chip).toBeInTheDocument();
      expect(chip).toHaveClass('text-[var(--md-sys-color-on-surface-variant)]');
      expect(chip).toHaveClass('border');
    });

    it('renders with default assist variant when no variant specified', () => {
      render(<M3Chip>Default Chip</M3Chip>);
      const chip = screen.getByRole('button', { name: /default chip/i });
      
      expect(chip).toHaveClass('text-[var(--md-sys-color-on-surface)]');
    });
  });


  describe('Selected State', () => {
    it('renders selected filter chip with correct styles', () => {
      render(<M3Chip variant="filter" selected>Selected Filter</M3Chip>);
      const chip = screen.getByRole('button', { name: /selected filter/i });
      
      expect(chip).toHaveClass('bg-[var(--md-sys-color-secondary-container)]');
      expect(chip).toHaveClass('text-[var(--md-sys-color-on-secondary-container)]');
      expect(chip).toHaveAttribute('aria-pressed', 'true');
    });

    it('renders unselected filter chip with aria-pressed false', () => {
      render(<M3Chip variant="filter" selected={false}>Unselected Filter</M3Chip>);
      const chip = screen.getByRole('button', { name: /unselected filter/i });
      
      expect(chip).toHaveAttribute('aria-pressed', 'false');
    });

    it('renders selected input chip with correct styles', () => {
      render(<M3Chip variant="input" selected>Selected Input</M3Chip>);
      const chip = screen.getByRole('button', { name: /selected input/i });
      
      expect(chip).toHaveClass('bg-[var(--md-sys-color-secondary-container)]');
      expect(chip).toHaveClass('text-[var(--md-sys-color-on-secondary-container)]');
    });

    it('shows checkmark icon for selected filter chips', () => {
      render(<M3Chip variant="filter" selected>Selected Filter</M3Chip>);
      const chip = screen.getByRole('button', { name: /selected filter/i });
      
      // Should have a checkmark SVG
      const checkmark = chip.querySelector('svg');
      expect(checkmark).toBeInTheDocument();
    });
  });

  describe('Elevated State', () => {
    it('renders elevated assist chip with shadow', () => {
      render(<M3Chip variant="assist" elevated>Elevated Assist</M3Chip>);
      const chip = screen.getByRole('button', { name: /elevated assist/i });
      
      expect(chip).toHaveClass('shadow-sm');
      expect(chip).toHaveClass('bg-[var(--md-sys-color-surface-container-low)]');
    });

    it('renders elevated suggestion chip with shadow', () => {
      render(<M3Chip variant="suggestion" elevated>Elevated Suggestion</M3Chip>);
      const chip = screen.getByRole('button', { name: /elevated suggestion/i });
      
      expect(chip).toHaveClass('shadow-sm');
      expect(chip).toHaveClass('bg-[var(--md-sys-color-surface-container-low)]');
    });
  });

  describe('Disabled State', () => {
    it('renders disabled chip with correct attributes', () => {
      render(<M3Chip disabled>Disabled Chip</M3Chip>);
      const chip = screen.getByRole('button', { name: /disabled chip/i });
      
      expect(chip).toBeDisabled();
      expect(chip).toHaveAttribute('aria-disabled', 'true');
      expect(chip).toHaveClass('opacity-38');
    });

    it('does not trigger onClick when disabled', () => {
      const handleClick = vi.fn();
      render(<M3Chip disabled onClick={handleClick}>Disabled Chip</M3Chip>);
      const chip = screen.getByRole('button', { name: /disabled chip/i });
      
      fireEvent.click(chip);
      expect(handleClick).not.toHaveBeenCalled();
    });
  });

  describe('Icon Support', () => {
    const TestIcon = () => <span data-testid="test-icon">Icon</span>;

    it('renders leading icon', () => {
      render(<M3Chip leadingIcon={<TestIcon />}>Chip with Icon</M3Chip>);
      const icon = screen.getByTestId('test-icon');
      
      expect(icon).toBeInTheDocument();
    });

    it('renders trailing icon', () => {
      render(<M3Chip trailingIcon={<TestIcon />}>Chip with Trailing</M3Chip>);
      const icon = screen.getByTestId('test-icon');
      
      expect(icon).toBeInTheDocument();
    });

    it('renders avatar for input chips', () => {
      const Avatar = () => <img data-testid="avatar" src="/test.jpg" alt="avatar" />;
      render(<M3Chip variant="input" avatar={<Avatar />}>User Chip</M3Chip>);
      const avatar = screen.getByTestId('avatar');
      
      expect(avatar).toBeInTheDocument();
    });
  });

  describe('Trailing Icon Click', () => {
    it('calls onTrailingIconClick when trailing icon is clicked', () => {
      const handleTrailingClick = vi.fn();
      const TestIcon = () => <span data-testid="trailing-icon">X</span>;
      
      render(
        <M3Chip 
          trailingIcon={<TestIcon />} 
          onTrailingIconClick={handleTrailingClick}
        >
          Removable Chip
        </M3Chip>
      );
      
      const trailingIcon = screen.getByTestId('trailing-icon');
      fireEvent.click(trailingIcon);
      
      expect(handleTrailingClick).toHaveBeenCalledTimes(1);
    });

    it('shows close icon for input chips with onTrailingIconClick', () => {
      const handleTrailingClick = vi.fn();
      
      render(
        <M3Chip 
          variant="input" 
          onTrailingIconClick={handleTrailingClick}
        >
          Input Chip
        </M3Chip>
      );
      
      const chip = screen.getByRole('button', { name: /input chip/i });
      // Should have a close icon SVG
      const closeIcon = chip.querySelector('svg');
      expect(closeIcon).toBeInTheDocument();
    });

    it('does not propagate click to chip when trailing icon is clicked', () => {
      const handleChipClick = vi.fn();
      const handleTrailingClick = vi.fn();
      const TestIcon = () => <span data-testid="trailing-icon">X</span>;
      
      render(
        <M3Chip 
          trailingIcon={<TestIcon />} 
          onClick={handleChipClick}
          onTrailingIconClick={handleTrailingClick}
        >
          Chip
        </M3Chip>
      );
      
      const trailingIcon = screen.getByTestId('trailing-icon');
      fireEvent.click(trailingIcon);
      
      expect(handleTrailingClick).toHaveBeenCalledTimes(1);
      expect(handleChipClick).not.toHaveBeenCalled();
    });
  });

  describe('Ripple Effect', () => {
    it('creates ripple element on click', () => {
      render(<M3Chip>Ripple Chip</M3Chip>);
      const chip = screen.getByRole('button', { name: /ripple chip/i });
      
      fireEvent.click(chip, { clientX: 50, clientY: 25 });
      
      const ripple = chip.querySelector('.animate-ripple');
      expect(ripple).toBeInTheDocument();
    });

    it('removes ripple element after animation completes', async () => {
      render(<M3Chip>Ripple Chip</M3Chip>);
      const chip = screen.getByRole('button', { name: /ripple chip/i });
      
      fireEvent.click(chip, { clientX: 50, clientY: 25 });
      
      expect(chip.querySelector('.animate-ripple')).toBeInTheDocument();
      
      await act(async () => {
        vi.advanceTimersByTime(600);
      });
      
      expect(chip.querySelector('.animate-ripple')).not.toBeInTheDocument();
    });

    it('does not create ripple when disabled', () => {
      render(<M3Chip disabled>Disabled Chip</M3Chip>);
      const chip = screen.getByRole('button', { name: /disabled chip/i });
      
      fireEvent.click(chip, { clientX: 50, clientY: 25 });
      
      expect(chip.querySelector('.animate-ripple')).not.toBeInTheDocument();
    });
  });

  describe('Click Handler', () => {
    it('calls onClick handler when clicked', () => {
      const handleClick = vi.fn();
      render(<M3Chip onClick={handleClick}>Click Me</M3Chip>);
      const chip = screen.getByRole('button', { name: /click me/i });
      
      fireEvent.click(chip);
      expect(handleClick).toHaveBeenCalledTimes(1);
    });
  });

  describe('Custom className', () => {
    it('applies custom className', () => {
      render(<M3Chip className="custom-class">Custom Chip</M3Chip>);
      const chip = screen.getByRole('button', { name: /custom chip/i });
      
      expect(chip).toHaveClass('custom-class');
    });
  });

  describe('Shape', () => {
    it('renders with small corner radius (8px)', () => {
      render(<M3Chip>Shaped Chip</M3Chip>);
      const chip = screen.getByRole('button', { name: /shaped chip/i });
      
      expect(chip).toHaveClass('rounded-[var(--md-sys-shape-corner-small)]');
    });
  });
});
