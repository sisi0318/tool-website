/**
 * Unit Tests for M3 Switch Component
 * 
 * Tests track, thumb, and icon states, as well as interaction behaviors.
 * Requirements: 4.8
 */

import * as React from 'react';
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { M3Switch } from './switch';

describe('M3Switch Component', () => {
  describe('Basic Rendering', () => {
    it('renders switch with default size', () => {
      render(<M3Switch aria-label="Test switch" />);
      const switchEl = screen.getByRole('switch');
      
      expect(switchEl).toBeInTheDocument();
      expect(switchEl).toHaveClass('h-8');
      expect(switchEl).toHaveClass('w-[52px]');
    });

    it('renders switch with small size', () => {
      render(<M3Switch size="small" aria-label="Small switch" />);
      const switchEl = screen.getByRole('switch');
      
      expect(switchEl).toHaveClass('h-6');
      expect(switchEl).toHaveClass('w-10');
    });

    it('renders with full rounded corners (M3 shape)', () => {
      render(<M3Switch aria-label="Rounded switch" />);
      const switchEl = screen.getByRole('switch');
      
      expect(switchEl).toHaveClass('rounded-[var(--md-sys-shape-corner-full)]');
    });
  });

  describe('Track States', () => {
    it('renders unchecked track with correct colors', () => {
      render(<M3Switch aria-label="Unchecked switch" />);
      const switchEl = screen.getByRole('switch');
      
      expect(switchEl).toHaveClass('data-[state=unchecked]:bg-[var(--md-sys-color-surface-container-highest)]');
      expect(switchEl).toHaveClass('data-[state=unchecked]:border-[var(--md-sys-color-outline)]');
    });

    it('renders checked track with correct colors', () => {
      render(<M3Switch defaultChecked aria-label="Checked switch" />);
      const switchEl = screen.getByRole('switch');
      
      expect(switchEl).toHaveClass('data-[state=checked]:bg-[var(--md-sys-color-primary)]');
      expect(switchEl).toHaveClass('data-[state=checked]:border-[var(--md-sys-color-primary)]');
    });
  });

  describe('Thumb States', () => {
    it('renders thumb element', () => {
      render(<M3Switch aria-label="Switch with thumb" />);
      const switchEl = screen.getByRole('switch');
      const thumb = switchEl.querySelector('[class*="rounded-full"]');
      
      expect(thumb).toBeInTheDocument();
    });

    it('thumb has shadow for elevation', () => {
      render(<M3Switch aria-label="Switch with shadow" />);
      const switchEl = screen.getByRole('switch');
      const thumb = switchEl.querySelector('[class*="shadow-md"]');
      
      expect(thumb).toBeInTheDocument();
    });
  });

  describe('Icon States', () => {
    it('does not show icons by default', () => {
      render(<M3Switch aria-label="Switch without icons" />);
      const switchEl = screen.getByRole('switch');
      const svg = switchEl.querySelector('svg');
      
      expect(svg).not.toBeInTheDocument();
    });

    it('shows default icons when showIcons is true', () => {
      render(<M3Switch showIcons aria-label="Switch with icons" />);
      const switchEl = screen.getByRole('switch');
      const svgs = switchEl.querySelectorAll('svg');
      
      // Should have both check and close icons
      expect(svgs.length).toBe(2);
    });

    it('renders custom checked icon', () => {
      const CustomIcon = () => <span data-testid="custom-checked">✓</span>;
      render(
        <M3Switch 
          showIcons 
          checkedIcon={<CustomIcon />} 
          aria-label="Switch with custom icon" 
        />
      );
      
      expect(screen.getByTestId('custom-checked')).toBeInTheDocument();
    });

    it('renders custom unchecked icon', () => {
      const CustomIcon = () => <span data-testid="custom-unchecked">✗</span>;
      render(
        <M3Switch 
          showIcons 
          uncheckedIcon={<CustomIcon />} 
          aria-label="Switch with custom icon" 
        />
      );
      
      expect(screen.getByTestId('custom-unchecked')).toBeInTheDocument();
    });
  });

  describe('Disabled State', () => {
    it('renders disabled switch with correct attributes', () => {
      render(<M3Switch disabled aria-label="Disabled switch" />);
      const switchEl = screen.getByRole('switch');
      
      expect(switchEl).toBeDisabled();
      expect(switchEl).toHaveClass('disabled:opacity-38');
      expect(switchEl).toHaveClass('disabled:cursor-not-allowed');
    });

    it('does not toggle when disabled', () => {
      const handleChange = vi.fn();
      render(
        <M3Switch 
          disabled 
          onCheckedChange={handleChange} 
          aria-label="Disabled switch" 
        />
      );
      const switchEl = screen.getByRole('switch');
      
      fireEvent.click(switchEl);
      expect(handleChange).not.toHaveBeenCalled();
    });
  });

  describe('Interaction', () => {
    it('toggles state on click', () => {
      render(<M3Switch aria-label="Toggle switch" />);
      const switchEl = screen.getByRole('switch');
      
      expect(switchEl).toHaveAttribute('data-state', 'unchecked');
      
      fireEvent.click(switchEl);
      expect(switchEl).toHaveAttribute('data-state', 'checked');
      
      fireEvent.click(switchEl);
      expect(switchEl).toHaveAttribute('data-state', 'unchecked');
    });

    it('calls onCheckedChange when toggled', () => {
      const handleChange = vi.fn();
      render(
        <M3Switch 
          onCheckedChange={handleChange} 
          aria-label="Callback switch" 
        />
      );
      const switchEl = screen.getByRole('switch');
      
      fireEvent.click(switchEl);
      expect(handleChange).toHaveBeenCalledWith(true);
      
      fireEvent.click(switchEl);
      expect(handleChange).toHaveBeenCalledWith(false);
    });

    it('respects controlled checked prop', () => {
      const { rerender } = render(
        <M3Switch checked={false} aria-label="Controlled switch" />
      );
      const switchEl = screen.getByRole('switch');
      
      expect(switchEl).toHaveAttribute('data-state', 'unchecked');
      
      rerender(<M3Switch checked={true} aria-label="Controlled switch" />);
      expect(switchEl).toHaveAttribute('data-state', 'checked');
    });

    it('respects defaultChecked prop', () => {
      render(<M3Switch defaultChecked aria-label="Default checked switch" />);
      const switchEl = screen.getByRole('switch');
      
      expect(switchEl).toHaveAttribute('data-state', 'checked');
    });
  });

  describe('Focus States', () => {
    it('has focus ring styles', () => {
      render(<M3Switch aria-label="Focusable switch" />);
      const switchEl = screen.getByRole('switch');
      
      expect(switchEl).toHaveClass('focus-visible:ring-2');
      expect(switchEl).toHaveClass('focus-visible:ring-[var(--md-sys-color-primary)]');
    });
  });

  describe('Motion/Transitions', () => {
    it('has M3 motion duration for transitions', () => {
      render(<M3Switch aria-label="Animated switch" />);
      const switchEl = screen.getByRole('switch');
      
      expect(switchEl).toHaveClass('duration-[var(--md-sys-motion-duration-short4)]');
      expect(switchEl).toHaveClass('ease-[var(--md-sys-motion-easing-standard)]');
    });
  });

  describe('Custom className', () => {
    it('applies custom className', () => {
      render(<M3Switch className="custom-class" aria-label="Custom switch" />);
      const switchEl = screen.getByRole('switch');
      
      expect(switchEl).toHaveClass('custom-class');
    });
  });

  describe('Accessibility', () => {
    it('has correct role', () => {
      render(<M3Switch aria-label="Accessible switch" />);
      const switchEl = screen.getByRole('switch');
      
      expect(switchEl).toBeInTheDocument();
    });

    it('supports aria-label', () => {
      render(<M3Switch aria-label="Toggle notifications" />);
      const switchEl = screen.getByRole('switch', { name: /toggle notifications/i });
      
      expect(switchEl).toBeInTheDocument();
    });

    it('supports aria-labelledby', () => {
      render(
        <>
          <label id="switch-label">Enable feature</label>
          <M3Switch aria-labelledby="switch-label" />
        </>
      );
      const switchEl = screen.getByRole('switch');
      
      expect(switchEl).toHaveAttribute('aria-labelledby', 'switch-label');
    });
  });
});
