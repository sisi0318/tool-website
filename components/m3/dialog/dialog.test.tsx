/**
 * Unit Tests for M3 Dialog Component
 * 
 * Tests dialog rendering, scrim opacity, surface colors, and action button placement.
 * Requirements: 4.6
 */

import * as React from 'react';
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import {
  M3Dialog,
  M3DialogTrigger,
  M3DialogContent,
  M3DialogHeader,
  M3DialogFooter,
  M3DialogTitle,
  M3DialogDescription,
  M3DialogClose,
} from './dialog';

describe('M3Dialog Component', () => {
  describe('Basic Rendering', () => {
    it('renders dialog when open', async () => {
      render(
        <M3Dialog defaultOpen>
          <M3DialogContent>
            <M3DialogTitle>Test Dialog</M3DialogTitle>
          </M3DialogContent>
        </M3Dialog>
      );

      await waitFor(() => {
        expect(screen.getByText('Test Dialog')).toBeInTheDocument();
      });
    });

    it('renders dialog trigger correctly', () => {
      render(
        <M3Dialog>
          <M3DialogTrigger>Open Dialog</M3DialogTrigger>
          <M3DialogContent>
            <M3DialogTitle>Test Dialog</M3DialogTitle>
          </M3DialogContent>
        </M3Dialog>
      );

      expect(screen.getByText('Open Dialog')).toBeInTheDocument();
    });

    it('opens dialog when trigger is clicked', async () => {
      render(
        <M3Dialog>
          <M3DialogTrigger>Open Dialog</M3DialogTrigger>
          <M3DialogContent>
            <M3DialogTitle>Test Dialog</M3DialogTitle>
          </M3DialogContent>
        </M3Dialog>
      );

      fireEvent.click(screen.getByText('Open Dialog'));

      await waitFor(() => {
        expect(screen.getByText('Test Dialog')).toBeInTheDocument();
      });
    });
  });


  describe('Scrim (Overlay)', () => {
    it('renders overlay with correct scrim opacity class (32%)', async () => {
      render(
        <M3Dialog defaultOpen>
          <M3DialogContent>
            <M3DialogTitle>Test Dialog</M3DialogTitle>
          </M3DialogContent>
        </M3Dialog>
      );

      await waitFor(() => {
        // Find the overlay element
        const overlay = document.querySelector('[data-state="open"]');
        expect(overlay).toHaveClass('bg-[var(--md-sys-color-scrim)]/[0.32]');
      });
    });
  });

  describe('Surface Container High Background', () => {
    it('renders content with surface-container-high background', async () => {
      render(
        <M3Dialog defaultOpen>
          <M3DialogContent>
            <M3DialogTitle>Test Dialog</M3DialogTitle>
          </M3DialogContent>
        </M3Dialog>
      );

      await waitFor(() => {
        const content = screen.getByRole('dialog');
        expect(content).toHaveClass('bg-[var(--md-sys-color-surface-container-high)]');
      });
    });

    it('renders content with on-surface text color', async () => {
      render(
        <M3Dialog defaultOpen>
          <M3DialogContent>
            <M3DialogTitle>Test Dialog</M3DialogTitle>
          </M3DialogContent>
        </M3Dialog>
      );

      await waitFor(() => {
        const content = screen.getByRole('dialog');
        expect(content).toHaveClass('text-[var(--md-sys-color-on-surface)]');
      });
    });
  });

  describe('M3 Expressive Shape', () => {
    it('renders content with extra-large corner radius', async () => {
      render(
        <M3Dialog defaultOpen>
          <M3DialogContent>
            <M3DialogTitle>Test Dialog</M3DialogTitle>
          </M3DialogContent>
        </M3Dialog>
      );

      await waitFor(() => {
        const content = screen.getByRole('dialog');
        expect(content).toHaveClass('rounded-[var(--md-sys-shape-corner-extra-large)]');
      });
    });
  });

  describe('Size Variants', () => {
    it('renders small size variant', async () => {
      render(
        <M3Dialog defaultOpen>
          <M3DialogContent size="small">
            <M3DialogTitle>Small Dialog</M3DialogTitle>
          </M3DialogContent>
        </M3Dialog>
      );

      await waitFor(() => {
        const content = screen.getByRole('dialog');
        expect(content).toHaveClass('max-w-sm');
      });
    });

    it('renders medium size variant (default)', async () => {
      render(
        <M3Dialog defaultOpen>
          <M3DialogContent>
            <M3DialogTitle>Medium Dialog</M3DialogTitle>
          </M3DialogContent>
        </M3Dialog>
      );

      await waitFor(() => {
        const content = screen.getByRole('dialog');
        expect(content).toHaveClass('max-w-lg');
      });
    });

    it('renders large size variant', async () => {
      render(
        <M3Dialog defaultOpen>
          <M3DialogContent size="large">
            <M3DialogTitle>Large Dialog</M3DialogTitle>
          </M3DialogContent>
        </M3Dialog>
      );

      await waitFor(() => {
        const content = screen.getByRole('dialog');
        expect(content).toHaveClass('max-w-2xl');
      });
    });
  });


  describe('Close Button', () => {
    it('renders close button by default', async () => {
      render(
        <M3Dialog defaultOpen>
          <M3DialogContent>
            <M3DialogTitle>Test Dialog</M3DialogTitle>
          </M3DialogContent>
        </M3Dialog>
      );

      await waitFor(() => {
        const closeButton = screen.getByLabelText('Close');
        expect(closeButton).toBeInTheDocument();
      });
    });

    it('hides close button when showCloseButton is false', async () => {
      render(
        <M3Dialog defaultOpen>
          <M3DialogContent showCloseButton={false}>
            <M3DialogTitle>Test Dialog</M3DialogTitle>
          </M3DialogContent>
        </M3Dialog>
      );

      await waitFor(() => {
        expect(screen.queryByLabelText('Close')).not.toBeInTheDocument();
      });
    });

    it('closes dialog when close button is clicked', async () => {
      const onOpenChange = vi.fn();
      render(
        <M3Dialog defaultOpen onOpenChange={onOpenChange}>
          <M3DialogContent>
            <M3DialogTitle>Test Dialog</M3DialogTitle>
          </M3DialogContent>
        </M3Dialog>
      );

      await waitFor(() => {
        const closeButton = screen.getByLabelText('Close');
        fireEvent.click(closeButton);
      });

      expect(onOpenChange).toHaveBeenCalledWith(false);
    });
  });

  describe('Dialog Header', () => {
    it('renders header with correct layout', async () => {
      render(
        <M3Dialog defaultOpen>
          <M3DialogContent>
            <M3DialogHeader>
              <M3DialogTitle>Dialog Title</M3DialogTitle>
              <M3DialogDescription>Dialog description</M3DialogDescription>
            </M3DialogHeader>
          </M3DialogContent>
        </M3Dialog>
      );

      await waitFor(() => {
        expect(screen.getByText('Dialog Title')).toBeInTheDocument();
        expect(screen.getByText('Dialog description')).toBeInTheDocument();
      });
    });
  });


  describe('Dialog Footer (Action Button Placement)', () => {
    it('renders footer with correct button alignment', async () => {
      render(
        <M3Dialog defaultOpen>
          <M3DialogContent>
            <M3DialogHeader>
              <M3DialogTitle>Confirm Action</M3DialogTitle>
            </M3DialogHeader>
            <M3DialogFooter>
              <button>Cancel</button>
              <button>Confirm</button>
            </M3DialogFooter>
          </M3DialogContent>
        </M3Dialog>
      );

      await waitFor(() => {
        expect(screen.getByText('Cancel')).toBeInTheDocument();
        expect(screen.getByText('Confirm')).toBeInTheDocument();
      });
    });

    it('footer has correct flex layout for button placement', async () => {
      render(
        <M3Dialog defaultOpen>
          <M3DialogContent>
            <M3DialogFooter data-testid="dialog-footer">
              <button>Cancel</button>
              <button>Confirm</button>
            </M3DialogFooter>
          </M3DialogContent>
        </M3Dialog>
      );

      await waitFor(() => {
        const footer = screen.getByTestId('dialog-footer');
        expect(footer).toHaveClass('sm:flex-row');
        expect(footer).toHaveClass('sm:justify-end');
      });
    });
  });

  describe('Dialog Title', () => {
    it('renders title with correct M3 typography', async () => {
      render(
        <M3Dialog defaultOpen>
          <M3DialogContent>
            <M3DialogTitle>Test Title</M3DialogTitle>
          </M3DialogContent>
        </M3Dialog>
      );

      await waitFor(() => {
        const title = screen.getByText('Test Title');
        expect(title).toHaveClass('text-lg');
        expect(title).toHaveClass('font-semibold');
        expect(title).toHaveClass('text-[var(--md-sys-color-on-surface)]');
      });
    });
  });

  describe('Dialog Description', () => {
    it('renders description with correct M3 typography', async () => {
      render(
        <M3Dialog defaultOpen>
          <M3DialogContent>
            <M3DialogDescription>Test Description</M3DialogDescription>
          </M3DialogContent>
        </M3Dialog>
      );

      await waitFor(() => {
        const description = screen.getByText('Test Description');
        expect(description).toHaveClass('text-sm');
        expect(description).toHaveClass('text-[var(--md-sys-color-on-surface-variant)]');
      });
    });
  });

  describe('Custom className', () => {
    it('applies custom className to content', async () => {
      render(
        <M3Dialog defaultOpen>
          <M3DialogContent className="custom-dialog-class">
            <M3DialogTitle>Test Dialog</M3DialogTitle>
          </M3DialogContent>
        </M3Dialog>
      );

      await waitFor(() => {
        const content = screen.getByRole('dialog');
        expect(content).toHaveClass('custom-dialog-class');
      });
    });
  });
});
