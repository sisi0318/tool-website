/**
 * Unit Tests for M3 Slider Component
 * 
 * Tests track, thumb, and value indicator states, as well as interaction behaviors.
 * Requirements: 4.9
 */

import * as React from 'react';
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { M3Slider } from './slider';

describe('M3Slider Component', () => {
  describe('Basic Rendering', () => {
    it('renders slider with default size', () => {
      render(<M3Slider aria-label="Test slider" />);
      const slider = screen.getByRole('slider');
      
      expect(slider).toBeInTheDocument();
    });

    it('renders slider with large size', () => {
      render(<M3Slider size="large" aria-label="Large slider" />);
      const slider = screen.getByRole('slider');
      
      expect(slider).toBeInTheDocument();
    });

    it('renders with full rounded corners (M3 shape)', () => {
      const { container } = render(<M3Slider aria-label="Rounded slider" />);
      const track = container.querySelector('[class*="rounded-[var(--md-sys-shape-corner-full)]"]');
      
      expect(track).toBeInTheDocument();
    });
  });

  describe('Track Styling', () => {
    it('renders track with M3 surface color', () => {
      const { container } = render(<M3Slider aria-label="Track slider" />);
      const track = container.querySelector('[class*="bg-[var(--md-sys-color-surface-container-highest)]"]');
      
      expect(track).toBeInTheDocument();
    });

    it('renders active range with primary color', () => {
      const { container } = render(<M3Slider defaultValue={[50]} aria-label="Range slider" />);
      const range = container.querySelector('[class*="bg-[var(--md-sys-color-primary)]"]');
      
      expect(range).toBeInTheDocument();
    });
  });


  describe('Thumb Styling', () => {
    it('renders thumb element', () => {
      render(<M3Slider aria-label="Thumb slider" />);
      const thumb = screen.getByRole('slider');
      
      expect(thumb).toBeInTheDocument();
      expect(thumb).toHaveClass('rounded-full');
    });

    it('thumb has shadow for elevation', () => {
      render(<M3Slider aria-label="Shadow slider" />);
      const thumb = screen.getByRole('slider');
      
      expect(thumb).toHaveClass('shadow-md');
    });

    it('thumb has M3 primary color', () => {
      render(<M3Slider aria-label="Primary slider" />);
      const thumb = screen.getByRole('slider');
      
      expect(thumb).toHaveClass('bg-[var(--md-sys-color-primary)]');
    });
  });

  describe('Value Indicator', () => {
    it('does not show value indicator by default', () => {
      render(<M3Slider aria-label="No indicator slider" />);
      const tooltip = screen.queryByRole('tooltip');
      
      expect(tooltip).not.toBeInTheDocument();
    });

    it('shows value indicator when showValueIndicator is true', () => {
      render(<M3Slider showValueIndicator aria-label="Indicator slider" />);
      const tooltip = screen.getByRole('tooltip', { hidden: true });
      
      expect(tooltip).toBeInTheDocument();
    });

    it('formats value with custom formatValue function', () => {
      const formatValue = (value: number) => `${value}%`;
      render(
        <M3Slider 
          showValueIndicator 
          formatValue={formatValue}
          defaultValue={[50]}
          aria-label="Formatted slider" 
        />
      );
      const tooltip = screen.getByRole('tooltip', { hidden: true });
      
      expect(tooltip).toHaveTextContent('50%');
    });
  });

  describe('Disabled State', () => {
    it('renders disabled slider with correct attributes', () => {
      render(<M3Slider disabled aria-label="Disabled slider" />);
      const slider = screen.getByRole('slider');
      
      // Radix UI uses data-disabled attribute
      expect(slider).toHaveAttribute('data-disabled');
    });

    it('has reduced opacity when disabled', () => {
      const { container } = render(<M3Slider disabled aria-label="Disabled slider" />);
      const root = container.querySelector('[class*="opacity-38"]');
      
      expect(root).toBeInTheDocument();
    });
  });

  describe('Value Control', () => {
    it('respects defaultValue prop', () => {
      render(<M3Slider defaultValue={[75]} aria-label="Default value slider" />);
      const slider = screen.getByRole('slider');
      
      expect(slider).toHaveAttribute('aria-valuenow', '75');
    });

    it('respects min and max props', () => {
      render(<M3Slider min={10} max={50} aria-label="Range slider" />);
      const slider = screen.getByRole('slider');
      
      expect(slider).toHaveAttribute('aria-valuemin', '10');
      expect(slider).toHaveAttribute('aria-valuemax', '50');
    });

    it('respects controlled value prop', () => {
      const { rerender } = render(
        <M3Slider value={[25]} aria-label="Controlled slider" />
      );
      const slider = screen.getByRole('slider');
      
      expect(slider).toHaveAttribute('aria-valuenow', '25');
      
      rerender(<M3Slider value={[75]} aria-label="Controlled slider" />);
      expect(slider).toHaveAttribute('aria-valuenow', '75');
    });

    it('calls onValueChange when value changes', () => {
      const handleChange = vi.fn();
      render(
        <M3Slider 
          onValueChange={handleChange} 
          aria-label="Callback slider" 
        />
      );
      const slider = screen.getByRole('slider');
      
      // Simulate keyboard interaction
      fireEvent.keyDown(slider, { key: 'ArrowRight' });
      expect(handleChange).toHaveBeenCalled();
    });
  });


  describe('Tick Marks', () => {
    it('does not show tick marks by default', () => {
      const { container } = render(<M3Slider aria-label="No ticks slider" />);
      const ticks = container.querySelectorAll('[class*="w-0.5"]');
      
      expect(ticks.length).toBe(0);
    });

    it('shows tick marks when showTicks is true', () => {
      const { container } = render(
        <M3Slider showTicks tickCount={5} aria-label="Ticks slider" />
      );
      const ticks = container.querySelectorAll('[class*="w-0.5"]');
      
      expect(ticks.length).toBe(5);
    });

    it('respects custom tickCount', () => {
      const { container } = render(
        <M3Slider showTicks tickCount={3} aria-label="Custom ticks slider" />
      );
      const ticks = container.querySelectorAll('[class*="w-0.5"]');
      
      expect(ticks.length).toBe(3);
    });
  });

  describe('Focus States', () => {
    it('has focus ring styles', () => {
      render(<M3Slider aria-label="Focusable slider" />);
      const slider = screen.getByRole('slider');
      
      expect(slider).toHaveClass('focus-visible:ring-2');
      expect(slider).toHaveClass('focus-visible:ring-[var(--md-sys-color-primary)]');
    });
  });

  describe('Motion/Transitions', () => {
    it('has M3 motion duration for transitions', () => {
      render(<M3Slider aria-label="Animated slider" />);
      const slider = screen.getByRole('slider');
      
      expect(slider).toHaveClass('duration-[var(--md-sys-motion-duration-short4)]');
      expect(slider).toHaveClass('ease-[var(--md-sys-motion-easing-standard)]');
    });
  });

  describe('Custom className', () => {
    it('applies custom className', () => {
      const { container } = render(
        <M3Slider className="custom-class" aria-label="Custom slider" />
      );
      const root = container.querySelector('.custom-class');
      
      expect(root).toBeInTheDocument();
    });
  });

  describe('Accessibility', () => {
    it('has correct role', () => {
      render(<M3Slider aria-label="Accessible slider" />);
      const slider = screen.getByRole('slider');
      
      expect(slider).toBeInTheDocument();
    });

    it('supports aria-label', () => {
      const { container } = render(<M3Slider aria-label="Volume control" />);
      // aria-label is on the root slider element, not the thumb
      const rootSlider = container.querySelector('[aria-label="Volume control"]');
      
      expect(rootSlider).toBeInTheDocument();
    });

    it('supports keyboard navigation', () => {
      const handleChange = vi.fn();
      render(
        <M3Slider 
          defaultValue={[50]} 
          onValueChange={handleChange}
          aria-label="Keyboard slider" 
        />
      );
      const slider = screen.getByRole('slider');
      
      // Arrow right should increase value
      fireEvent.keyDown(slider, { key: 'ArrowRight' });
      expect(handleChange).toHaveBeenCalledWith([51]);
      
      // Arrow left should decrease value
      fireEvent.keyDown(slider, { key: 'ArrowLeft' });
      expect(handleChange).toHaveBeenCalledWith([50]);
    });
  });
});
