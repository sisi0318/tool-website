/**
 * Unit Tests for M3 Progress Components
 * 
 * Tests linear and circular progress indicators including:
 * - Determinate and indeterminate modes
 * - Size variants
 * - Accessibility attributes
 * - M3 styling tokens
 * 
 * Requirements: 4.10
 */

import * as React from 'react';
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { M3LinearProgress } from './linear-progress';
import { M3CircularProgress } from './circular-progress';

describe('M3LinearProgress Component', () => {
  describe('Basic Rendering', () => {
    it('renders linear progress with default size', () => {
      render(<M3LinearProgress aria-label="Loading" />);
      const progress = screen.getByRole('progressbar');
      
      expect(progress).toBeInTheDocument();
    });

    it('renders linear progress with large size', () => {
      const { container } = render(<M3LinearProgress size="large" aria-label="Loading" />);
      const track = container.querySelector('.h-2');
      
      expect(track).toBeInTheDocument();
    });

    it('renders with full rounded corners (M3 shape)', () => {
      const { container } = render(<M3LinearProgress aria-label="Loading" />);
      const track = container.querySelector('[class*="rounded-[var(--md-sys-shape-corner-full)]"]');
      
      expect(track).toBeInTheDocument();
    });
  });

  describe('Determinate Mode', () => {
    it('shows correct progress value', () => {
      render(<M3LinearProgress value={50} aria-label="Loading" />);
      const progress = screen.getByRole('progressbar');
      
      expect(progress).toHaveAttribute('aria-valuenow', '50');
    });

    it('respects max prop', () => {
      render(<M3LinearProgress value={50} max={200} aria-label="Loading" />);
      const progress = screen.getByRole('progressbar');
      
      expect(progress).toHaveAttribute('aria-valuemax', '200');
    });

    it('clamps value to min/max range', () => {
      render(<M3LinearProgress value={150} max={100} aria-label="Loading" />);
      const progress = screen.getByRole('progressbar');
      
      // Value should be clamped to max
      expect(progress).toHaveAttribute('aria-valuenow', '100');
    });

    it('clamps negative values to 0', () => {
      render(<M3LinearProgress value={-10} aria-label="Loading" />);
      const progress = screen.getByRole('progressbar');
      
      expect(progress).toHaveAttribute('aria-valuenow', '0');
    });

    it('has transition styles for smooth progress updates', () => {
      const { container } = render(<M3LinearProgress value={50} aria-label="Loading" />);
      const indicator = container.querySelector('[class*="transition-[width]"]');
      
      expect(indicator).toBeInTheDocument();
    });
  });

  describe('Indeterminate Mode', () => {
    it('renders indeterminate when value is undefined', () => {
      render(<M3LinearProgress aria-label="Loading" />);
      const progress = screen.getByRole('progressbar');
      
      expect(progress).not.toHaveAttribute('aria-valuenow');
    });

    it('has animation class for indeterminate state', () => {
      const { container } = render(<M3LinearProgress aria-label="Loading" />);
      const indicator = container.querySelector('.animate-m3-linear-progress-indeterminate');
      
      expect(indicator).toBeInTheDocument();
    });
  });

  describe('Track Styling', () => {
    it('renders track with M3 surface color', () => {
      const { container } = render(<M3LinearProgress aria-label="Loading" />);
      const track = container.querySelector('[class*="bg-[var(--md-sys-color-surface-container-highest)]"]');
      
      expect(track).toBeInTheDocument();
    });

    it('renders indicator with primary color', () => {
      const { container } = render(<M3LinearProgress value={50} aria-label="Loading" />);
      const indicator = container.querySelector('[class*="bg-[var(--md-sys-color-primary)]"]');
      
      expect(indicator).toBeInTheDocument();
    });
  });

  describe('Accessibility', () => {
    it('has correct role', () => {
      render(<M3LinearProgress aria-label="Loading" />);
      const progress = screen.getByRole('progressbar');
      
      expect(progress).toBeInTheDocument();
    });

    it('supports aria-label', () => {
      render(<M3LinearProgress aria-label="Loading content" />);
      const progress = screen.getByRole('progressbar');
      
      expect(progress).toHaveAttribute('aria-label', 'Loading content');
    });

    it('supports aria-labelledby', () => {
      render(
        <>
          <span id="progress-label">Loading files</span>
          <M3LinearProgress aria-labelledby="progress-label" />
        </>
      );
      const progress = screen.getByRole('progressbar');
      
      expect(progress).toHaveAttribute('aria-labelledby', 'progress-label');
    });

    it('has aria-valuemin set to 0', () => {
      render(<M3LinearProgress value={50} aria-label="Loading" />);
      const progress = screen.getByRole('progressbar');
      
      expect(progress).toHaveAttribute('aria-valuemin', '0');
    });
  });

  describe('Custom className', () => {
    it('applies custom className', () => {
      const { container } = render(
        <M3LinearProgress className="custom-class" aria-label="Loading" />
      );
      const progress = container.querySelector('.custom-class');
      
      expect(progress).toBeInTheDocument();
    });
  });
});

describe('M3CircularProgress Component', () => {
  describe('Basic Rendering', () => {
    it('renders circular progress with default size', () => {
      render(<M3CircularProgress aria-label="Loading" />);
      const progress = screen.getByRole('progressbar');
      
      expect(progress).toBeInTheDocument();
    });

    it('renders circular progress with small size', () => {
      const { container } = render(<M3CircularProgress size="small" aria-label="Loading" />);
      const svg = container.querySelector('.h-6.w-6');
      
      expect(svg).toBeInTheDocument();
    });

    it('renders circular progress with large size', () => {
      const { container } = render(<M3CircularProgress size="large" aria-label="Loading" />);
      const svg = container.querySelector('.h-12.w-12');
      
      expect(svg).toBeInTheDocument();
    });

    it('renders as SVG element', () => {
      const { container } = render(<M3CircularProgress aria-label="Loading" />);
      const svg = container.querySelector('svg');
      
      expect(svg).toBeInTheDocument();
    });
  });

  describe('Determinate Mode', () => {
    it('shows correct progress value', () => {
      render(<M3CircularProgress value={75} aria-label="Loading" />);
      const progress = screen.getByRole('progressbar');
      
      expect(progress).toHaveAttribute('aria-valuenow', '75');
    });

    it('respects max prop', () => {
      render(<M3CircularProgress value={50} max={200} aria-label="Loading" />);
      const progress = screen.getByRole('progressbar');
      
      expect(progress).toHaveAttribute('aria-valuemax', '200');
    });

    it('clamps value to min/max range', () => {
      render(<M3CircularProgress value={150} max={100} aria-label="Loading" />);
      const progress = screen.getByRole('progressbar');
      
      expect(progress).toHaveAttribute('aria-valuenow', '100');
    });

    it('has transition styles for smooth progress updates', () => {
      const { container } = render(<M3CircularProgress value={50} aria-label="Loading" />);
      const circle = container.querySelector('[class*="transition-[stroke-dashoffset]"]');
      
      expect(circle).toBeInTheDocument();
    });
  });

  describe('Indeterminate Mode', () => {
    it('renders indeterminate when value is undefined', () => {
      render(<M3CircularProgress aria-label="Loading" />);
      const progress = screen.getByRole('progressbar');
      
      expect(progress).not.toHaveAttribute('aria-valuenow');
    });

    it('has rotation animation class for indeterminate state', () => {
      const { container } = render(<M3CircularProgress aria-label="Loading" />);
      const svg = container.querySelector('.animate-m3-circular-progress-rotate');
      
      expect(svg).toBeInTheDocument();
    });

    it('has dash animation class for indeterminate state', () => {
      const { container } = render(<M3CircularProgress aria-label="Loading" />);
      const circle = container.querySelector('.animate-m3-circular-progress-dash');
      
      expect(circle).toBeInTheDocument();
    });
  });

  describe('SVG Structure', () => {
    it('renders track circle', () => {
      const { container } = render(<M3CircularProgress aria-label="Loading" />);
      const circles = container.querySelectorAll('circle');
      
      expect(circles.length).toBe(2); // Track and indicator
    });

    it('renders track with M3 surface color', () => {
      const { container } = render(<M3CircularProgress aria-label="Loading" />);
      const circles = container.querySelectorAll('circle');
      // First circle is the track
      const trackCircle = circles[0];
      
      expect(trackCircle).toHaveClass('stroke-[var(--md-sys-color-surface-container-highest)]');
    });

    it('renders indicator with primary color', () => {
      const { container } = render(<M3CircularProgress aria-label="Loading" />);
      const circles = container.querySelectorAll('circle');
      // Second circle is the indicator
      const indicatorCircle = circles[1];
      
      expect(indicatorCircle).toHaveClass('stroke-[var(--md-sys-color-primary)]');
    });

    it('has correct viewBox', () => {
      const { container } = render(<M3CircularProgress aria-label="Loading" />);
      const svg = container.querySelector('svg');
      
      expect(svg).toHaveAttribute('viewBox', '0 0 44 44');
    });

    it('indicator circle has round linecap', () => {
      const { container } = render(<M3CircularProgress aria-label="Loading" />);
      const indicatorCircle = container.querySelector('[stroke-linecap="round"]');
      
      expect(indicatorCircle).toBeInTheDocument();
    });
  });

  describe('Accessibility', () => {
    it('has correct role', () => {
      render(<M3CircularProgress aria-label="Loading" />);
      const progress = screen.getByRole('progressbar');
      
      expect(progress).toBeInTheDocument();
    });

    it('supports aria-label', () => {
      render(<M3CircularProgress aria-label="Loading content" />);
      const progress = screen.getByRole('progressbar');
      
      expect(progress).toHaveAttribute('aria-label', 'Loading content');
    });

    it('supports aria-labelledby', () => {
      render(
        <>
          <span id="progress-label">Loading files</span>
          <M3CircularProgress aria-labelledby="progress-label" />
        </>
      );
      const progress = screen.getByRole('progressbar');
      
      expect(progress).toHaveAttribute('aria-labelledby', 'progress-label');
    });

    it('has aria-valuemin set to 0', () => {
      render(<M3CircularProgress value={50} aria-label="Loading" />);
      const progress = screen.getByRole('progressbar');
      
      expect(progress).toHaveAttribute('aria-valuemin', '0');
    });
  });

  describe('Custom className', () => {
    it('applies custom className', () => {
      const { container } = render(
        <M3CircularProgress className="custom-class" aria-label="Loading" />
      );
      const progress = container.querySelector('.custom-class');
      
      expect(progress).toBeInTheDocument();
    });
  });
});
