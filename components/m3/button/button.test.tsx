/**
 * Unit Tests for M3 Button Component
 * 
 * Tests all variant renderings, disabled and loading states, and ripple effect trigger.
 * Requirements: 4.1, 3.3, 5.4
 */

import * as React from 'react';
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent, act } from '@testing-library/react';
import { M3Button } from './button';

// Mock for testing ripple effect timing
vi.useFakeTimers();

describe('M3Button Component', () => {
  describe('Variant Renderings', () => {
    it('renders filled variant with correct styles', () => {
      render(<M3Button variant="filled">Filled Button</M3Button>);
      const button = screen.getByRole('button', { name: /filled button/i });
      
      expect(button).toBeInTheDocument();
      expect(button).toHaveClass('bg-[var(--md-sys-color-primary)]');
      expect(button).toHaveClass('text-[var(--md-sys-color-on-primary)]');
    });

    it('renders outlined variant with correct styles', () => {
      render(<M3Button variant="outlined">Outlined Button</M3Button>);
      const button = screen.getByRole('button', { name: /outlined button/i });
      
      expect(button).toBeInTheDocument();
      expect(button).toHaveClass('border');
      expect(button).toHaveClass('border-[var(--md-sys-color-outline)]');
      expect(button).toHaveClass('text-[var(--md-sys-color-primary)]');
    });

    it('renders text variant with correct styles', () => {
      render(<M3Button variant="text">Text Button</M3Button>);
      const button = screen.getByRole('button', { name: /text button/i });
      
      expect(button).toBeInTheDocument();
      expect(button).toHaveClass('bg-transparent');
      expect(button).toHaveClass('text-[var(--md-sys-color-primary)]');
    });

    it('renders elevated variant with correct styles', () => {
      render(<M3Button variant="elevated">Elevated Button</M3Button>);
      const button = screen.getByRole('button', { name: /elevated button/i });
      
      expect(button).toBeInTheDocument();
      expect(button).toHaveClass('bg-[var(--md-sys-color-surface-container-low)]');
      expect(button).toHaveClass('shadow-md');
    });

    it('renders tonal variant with correct styles', () => {
      render(<M3Button variant="tonal">Tonal Button</M3Button>);
      const button = screen.getByRole('button', { name: /tonal button/i });
      
      expect(button).toBeInTheDocument();
      expect(button).toHaveClass('bg-[var(--md-sys-color-secondary-container)]');
      expect(button).toHaveClass('text-[var(--md-sys-color-on-secondary-container)]');
    });

    it('renders with default filled variant when no variant specified', () => {
      render(<M3Button>Default Button</M3Button>);
      const button = screen.getByRole('button', { name: /default button/i });
      
      expect(button).toHaveClass('bg-[var(--md-sys-color-primary)]');
    });
  });

  describe('Size Variants', () => {
    it('renders small size with correct styles', () => {
      render(<M3Button size="small">Small Button</M3Button>);
      const button = screen.getByRole('button', { name: /small button/i });
      
      expect(button).toHaveClass('h-9');
      expect(button).toHaveClass('px-3');
      expect(button).toHaveClass('rounded-[var(--md-sys-shape-corner-small)]');
    });

    it('renders medium size with correct styles', () => {
      render(<M3Button size="medium">Medium Button</M3Button>);
      const button = screen.getByRole('button', { name: /medium button/i });
      
      expect(button).toHaveClass('h-10');
      expect(button).toHaveClass('px-6');
      expect(button).toHaveClass('rounded-[var(--md-sys-shape-corner-medium)]');
    });

    it('renders large size with correct styles', () => {
      render(<M3Button size="large">Large Button</M3Button>);
      const button = screen.getByRole('button', { name: /large button/i });
      
      expect(button).toHaveClass('h-12');
      expect(button).toHaveClass('px-8');
    });
  });

  describe('FAB Mode', () => {
    it('renders with full rounded corners when fab is true', () => {
      render(<M3Button fab>FAB Button</M3Button>);
      const button = screen.getByRole('button', { name: /fab button/i });
      
      expect(button).toHaveClass('rounded-[var(--md-sys-shape-corner-full)]');
    });
  });

  describe('Disabled State', () => {
    it('renders disabled button with correct attributes', () => {
      render(<M3Button disabled>Disabled Button</M3Button>);
      const button = screen.getByRole('button', { name: /disabled button/i });
      
      expect(button).toBeDisabled();
      expect(button).toHaveAttribute('aria-disabled', 'true');
      expect(button).toHaveClass('disabled:opacity-38');
    });

    it('does not trigger onClick when disabled', () => {
      const handleClick = vi.fn();
      render(<M3Button disabled onClick={handleClick}>Disabled Button</M3Button>);
      const button = screen.getByRole('button', { name: /disabled button/i });
      
      fireEvent.click(button);
      expect(handleClick).not.toHaveBeenCalled();
    });
  });

  describe('Loading State', () => {
    it('renders loading spinner when loading is true', () => {
      render(<M3Button loading>Loading Button</M3Button>);
      const button = screen.getByRole('button', { name: /loading button/i });
      
      // Button should be disabled when loading
      expect(button).toBeDisabled();
      expect(button).toHaveAttribute('aria-busy', 'true');
      
      // Should have a spinner (svg with animate-spin class)
      const spinner = button.querySelector('svg.animate-spin');
      expect(spinner).toBeInTheDocument();
    });

    it('hides content text when loading', () => {
      render(<M3Button loading>Loading Button</M3Button>);
      const button = screen.getByRole('button', { name: /loading button/i });
      
      // The text should have opacity-0 class
      const textSpan = button.querySelector('span.opacity-0');
      expect(textSpan).toBeInTheDocument();
    });

    it('does not trigger onClick when loading', () => {
      const handleClick = vi.fn();
      render(<M3Button loading onClick={handleClick}>Loading Button</M3Button>);
      const button = screen.getByRole('button', { name: /loading button/i });
      
      fireEvent.click(button);
      expect(handleClick).not.toHaveBeenCalled();
    });
  });

  describe('Icon Support', () => {
    const TestIcon = () => <span data-testid="test-icon">Icon</span>;

    it('renders icon at start position by default', () => {
      render(<M3Button icon={<TestIcon />}>Button with Icon</M3Button>);
      const button = screen.getByRole('button', { name: /button with icon/i });
      const icon = screen.getByTestId('test-icon');
      
      expect(icon).toBeInTheDocument();
      // Icon should come before the text
      const children = Array.from(button.children);
      const iconIndex = children.findIndex(child => child.contains(icon));
      const textIndex = children.findIndex(child => child.textContent === 'Button with Icon');
      expect(iconIndex).toBeLessThan(textIndex);
    });

    it('renders icon at end position when specified', () => {
      render(<M3Button icon={<TestIcon />} iconPosition="end">Button with Icon</M3Button>);
      const button = screen.getByRole('button', { name: /button with icon/i });
      const icon = screen.getByTestId('test-icon');
      
      expect(icon).toBeInTheDocument();
      // Icon should come after the text
      const children = Array.from(button.children);
      const iconIndex = children.findIndex(child => child.contains(icon));
      const textIndex = children.findIndex(child => child.textContent === 'Button with Icon');
      expect(iconIndex).toBeGreaterThan(textIndex);
    });

    it('does not render icon when loading', () => {
      render(<M3Button icon={<TestIcon />} loading>Button with Icon</M3Button>);
      
      expect(screen.queryByTestId('test-icon')).not.toBeInTheDocument();
    });
  });

  describe('Ripple Effect', () => {
    it('creates ripple element on click', () => {
      render(<M3Button>Ripple Button</M3Button>);
      const button = screen.getByRole('button', { name: /ripple button/i });
      
      // Click the button
      fireEvent.click(button, { clientX: 50, clientY: 25 });
      
      // Should have a ripple element
      const ripple = button.querySelector('.animate-ripple');
      expect(ripple).toBeInTheDocument();
    });

    it('removes ripple element after animation completes', async () => {
      render(<M3Button>Ripple Button</M3Button>);
      const button = screen.getByRole('button', { name: /ripple button/i });
      
      // Click the button
      fireEvent.click(button, { clientX: 50, clientY: 25 });
      
      // Ripple should exist initially
      expect(button.querySelector('.animate-ripple')).toBeInTheDocument();
      
      // Fast-forward time to after ripple animation (600ms) wrapped in act
      await act(async () => {
        vi.advanceTimersByTime(600);
      });
      
      // Ripple should be removed
      expect(button.querySelector('.animate-ripple')).not.toBeInTheDocument();
    });

    it('does not create ripple when disabled', () => {
      render(<M3Button disabled>Disabled Button</M3Button>);
      const button = screen.getByRole('button', { name: /disabled button/i });
      
      fireEvent.click(button, { clientX: 50, clientY: 25 });
      
      // Should not have a ripple element
      expect(button.querySelector('.animate-ripple')).not.toBeInTheDocument();
    });
  });

  describe('Click Handler', () => {
    it('calls onClick handler when clicked', () => {
      const handleClick = vi.fn();
      render(<M3Button onClick={handleClick}>Click Me</M3Button>);
      const button = screen.getByRole('button', { name: /click me/i });
      
      fireEvent.click(button);
      expect(handleClick).toHaveBeenCalledTimes(1);
    });
  });

  describe('Full Width', () => {
    it('renders full width when fullWidth is true', () => {
      render(<M3Button fullWidth>Full Width Button</M3Button>);
      const button = screen.getByRole('button', { name: /full width button/i });
      
      expect(button).toHaveClass('w-full');
    });
  });

  describe('Custom className', () => {
    it('applies custom className', () => {
      render(<M3Button className="custom-class">Custom Button</M3Button>);
      const button = screen.getByRole('button', { name: /custom button/i });
      
      expect(button).toHaveClass('custom-class');
    });
  });
});
