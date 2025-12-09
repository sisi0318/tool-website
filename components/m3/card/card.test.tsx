/**
 * Unit Tests for M3 Card Component
 * 
 * Tests all variant renderings and interactive state changes.
 * Requirements: 4.2, 3.2, 8.1, 8.2, 8.3
 */

import * as React from 'react';
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent, act } from '@testing-library/react';
import { M3Card } from './card';

// Mock for testing ripple effect timing
vi.useFakeTimers();

describe('M3Card Component', () => {
  describe('Variant Renderings', () => {
    it('renders elevated variant with correct styles', () => {
      render(<M3Card variant="elevated">Elevated Card</M3Card>);
      const card = screen.getByText('Elevated Card').closest('div');
      
      expect(card?.parentElement).toHaveClass('bg-[var(--md-sys-color-surface-container-low)]');
      expect(card?.parentElement).toHaveClass('text-[var(--md-sys-color-on-surface)]');
      expect(card?.parentElement).toHaveClass('shadow-md');
    });

    it('renders filled variant with correct styles', () => {
      render(<M3Card variant="filled">Filled Card</M3Card>);
      const card = screen.getByText('Filled Card').closest('div');
      
      expect(card?.parentElement).toHaveClass('bg-[var(--md-sys-color-surface-container-highest)]');
      expect(card?.parentElement).toHaveClass('text-[var(--md-sys-color-on-surface)]');
    });

    it('renders outlined variant with correct styles', () => {
      render(<M3Card variant="outlined">Outlined Card</M3Card>);
      const card = screen.getByText('Outlined Card').closest('div');
      
      expect(card?.parentElement).toHaveClass('bg-[var(--md-sys-color-surface)]');
      expect(card?.parentElement).toHaveClass('border');
      expect(card?.parentElement).toHaveClass('border-[var(--md-sys-color-outline-variant)]');
    });

    it('renders with default elevated variant when no variant specified', () => {
      render(<M3Card>Default Card</M3Card>);
      const card = screen.getByText('Default Card').closest('div');
      
      expect(card?.parentElement).toHaveClass('bg-[var(--md-sys-color-surface-container-low)]');
      expect(card?.parentElement).toHaveClass('shadow-md');
    });
  });


  describe('Shape Variants', () => {
    it('renders medium shape with correct corner radius', () => {
      render(<M3Card shape="medium">Medium Shape Card</M3Card>);
      const card = screen.getByText('Medium Shape Card').closest('div');
      
      expect(card?.parentElement).toHaveClass('rounded-[var(--md-sys-shape-corner-medium)]');
    });

    it('renders large shape with correct corner radius (default)', () => {
      render(<M3Card shape="large">Large Shape Card</M3Card>);
      const card = screen.getByText('Large Shape Card').closest('div');
      
      expect(card?.parentElement).toHaveClass('rounded-[var(--md-sys-shape-corner-large)]');
    });

    it('renders extraLarge shape with correct corner radius', () => {
      render(<M3Card shape="extraLarge">Extra Large Shape Card</M3Card>);
      const card = screen.getByText('Extra Large Shape Card').closest('div');
      
      expect(card?.parentElement).toHaveClass('rounded-[var(--md-sys-shape-corner-extra-large)]');
    });

    it('renders with default large shape when no shape specified', () => {
      render(<M3Card>Default Shape Card</M3Card>);
      const card = screen.getByText('Default Shape Card').closest('div');
      
      expect(card?.parentElement).toHaveClass('rounded-[var(--md-sys-shape-corner-large)]');
    });
  });

  describe('Interactive State Changes', () => {
    it('renders as interactive when interactive prop is true', () => {
      render(<M3Card interactive>Interactive Card</M3Card>);
      const card = screen.getByRole('button');
      
      expect(card).toHaveClass('cursor-pointer');
      expect(card).toHaveAttribute('tabIndex', '0');
    });

    it('does not render as interactive by default', () => {
      render(<M3Card>Non-Interactive Card</M3Card>);
      const card = screen.getByText('Non-Interactive Card').closest('div')?.parentElement;
      
      expect(card).not.toHaveClass('cursor-pointer');
      expect(card).not.toHaveAttribute('role', 'button');
    });

    it('shows hover state layer on mouse enter for interactive cards', () => {
      render(<M3Card interactive>Hover Card</M3Card>);
      const card = screen.getByRole('button');
      
      // Trigger mouse enter
      fireEvent.mouseEnter(card);
      
      // State layer should have hover opacity (0.08)
      const stateLayer = card.querySelector('span[aria-hidden="true"]');
      expect(stateLayer).toHaveStyle({ opacity: '0.08' });
    });

    it('shows pressed state layer on mouse down for interactive cards', () => {
      render(<M3Card interactive>Pressed Card</M3Card>);
      const card = screen.getByRole('button');
      
      // Trigger mouse down
      fireEvent.mouseDown(card);
      
      // State layer should have pressed opacity (0.12)
      const stateLayer = card.querySelector('span[aria-hidden="true"]');
      expect(stateLayer).toHaveStyle({ opacity: '0.12' });
    });

    it('removes state layer on mouse leave', () => {
      render(<M3Card interactive>Leave Card</M3Card>);
      const card = screen.getByRole('button');
      
      // Trigger mouse enter then leave
      fireEvent.mouseEnter(card);
      fireEvent.mouseLeave(card);
      
      // State layer should have 0 opacity
      const stateLayer = card.querySelector('span[aria-hidden="true"]');
      expect(stateLayer).toHaveStyle({ opacity: '0' });
    });
  });


  describe('Ripple Effect', () => {
    it('creates ripple element on click for interactive cards', () => {
      render(<M3Card interactive>Ripple Card</M3Card>);
      const card = screen.getByRole('button');
      
      // Click the card
      fireEvent.click(card, { clientX: 50, clientY: 25 });
      
      // Should have a ripple element
      const ripple = card.querySelector('.animate-ripple');
      expect(ripple).toBeInTheDocument();
    });

    it('removes ripple element after animation completes', async () => {
      render(<M3Card interactive>Ripple Card</M3Card>);
      const card = screen.getByRole('button');
      
      // Click the card
      fireEvent.click(card, { clientX: 50, clientY: 25 });
      
      // Ripple should exist initially
      expect(card.querySelector('.animate-ripple')).toBeInTheDocument();
      
      // Fast-forward time to after ripple animation (600ms)
      await act(async () => {
        vi.advanceTimersByTime(600);
      });
      
      // Ripple should be removed
      expect(card.querySelector('.animate-ripple')).not.toBeInTheDocument();
    });

    it('does not create ripple for non-interactive cards', () => {
      render(<M3Card>Non-Interactive Card</M3Card>);
      const card = screen.getByText('Non-Interactive Card').closest('div')?.parentElement;
      
      fireEvent.click(card!, { clientX: 50, clientY: 25 });
      
      // Should not have a ripple element
      expect(card?.querySelector('.animate-ripple')).not.toBeInTheDocument();
    });
  });

  describe('Click Handler', () => {
    it('calls onClick handler when interactive card is clicked', () => {
      const handleClick = vi.fn();
      render(<M3Card interactive onClick={handleClick}>Clickable Card</M3Card>);
      const card = screen.getByRole('button');
      
      fireEvent.click(card);
      expect(handleClick).toHaveBeenCalledTimes(1);
    });

    it('calls onClick handler for non-interactive card when provided', () => {
      const handleClick = vi.fn();
      render(<M3Card onClick={handleClick}>Clickable Card</M3Card>);
      const card = screen.getByText('Clickable Card').closest('div')?.parentElement;
      
      fireEvent.click(card!);
      expect(handleClick).toHaveBeenCalledTimes(1);
    });
  });

  describe('Keyboard Interaction', () => {
    it('triggers click on Enter key for interactive cards', () => {
      const handleClick = vi.fn();
      render(<M3Card interactive onClick={handleClick}>Keyboard Card</M3Card>);
      const card = screen.getByRole('button');
      
      fireEvent.keyDown(card, { key: 'Enter' });
      expect(handleClick).toHaveBeenCalledTimes(1);
    });

    it('triggers click on Space key for interactive cards', () => {
      const handleClick = vi.fn();
      render(<M3Card interactive onClick={handleClick}>Keyboard Card</M3Card>);
      const card = screen.getByRole('button');
      
      fireEvent.keyDown(card, { key: ' ' });
      expect(handleClick).toHaveBeenCalledTimes(1);
    });
  });

  describe('Full Width', () => {
    it('renders full width when fullWidth is true', () => {
      render(<M3Card fullWidth>Full Width Card</M3Card>);
      const card = screen.getByText('Full Width Card').closest('div')?.parentElement;
      
      expect(card).toHaveClass('w-full');
    });
  });

  describe('Custom Element', () => {
    it('renders as article when as="article"', () => {
      render(<M3Card as="article">Article Card</M3Card>);
      const card = screen.getByRole('article');
      
      expect(card).toBeInTheDocument();
    });

    it('renders as section when as="section"', () => {
      render(<M3Card as="section">Section Card</M3Card>);
      const card = document.querySelector('section');
      
      expect(card).toBeInTheDocument();
    });
  });

  describe('Custom className', () => {
    it('applies custom className', () => {
      render(<M3Card className="custom-class">Custom Card</M3Card>);
      const card = screen.getByText('Custom Card').closest('div')?.parentElement;
      
      expect(card).toHaveClass('custom-class');
    });
  });

  describe('Compound Variants', () => {
    it('elevated interactive card has hover:shadow-lg', () => {
      render(<M3Card variant="elevated" interactive>Elevated Interactive</M3Card>);
      const card = screen.getByRole('button');
      
      expect(card).toHaveClass('hover:shadow-lg');
    });

    it('filled interactive card has hover:shadow-sm', () => {
      render(<M3Card variant="filled" interactive>Filled Interactive</M3Card>);
      const card = screen.getByRole('button');
      
      expect(card).toHaveClass('hover:shadow-sm');
    });
  });
});
