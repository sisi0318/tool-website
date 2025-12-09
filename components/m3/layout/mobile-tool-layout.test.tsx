import React from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import {
  MobileToolLayout,
  MobileToolSection,
  MobileToolActions,
  shouldStackVertically,
} from './mobile-tool-layout';

// Mock the useBreakpoint hook
vi.mock('@/hooks/use-breakpoint', () => ({
  useBreakpoint: vi.fn(() => ({
    layoutMode: 'compact',
    isCompact: true,
    isMedium: false,
    isExpanded: false,
    width: 400,
  })),
}));

import { useBreakpoint } from '@/hooks/use-breakpoint';

describe('shouldStackVertically', () => {
  it('returns true for width < 600px', () => {
    expect(shouldStackVertically(0)).toBe(true);
    expect(shouldStackVertically(300)).toBe(true);
    expect(shouldStackVertically(599)).toBe(true);
  });

  it('returns false for width >= 600px', () => {
    expect(shouldStackVertically(600)).toBe(false);
    expect(shouldStackVertically(840)).toBe(false);
    expect(shouldStackVertically(1200)).toBe(false);
  });
});

describe('MobileToolLayout', () => {
  beforeEach(() => {
    vi.mocked(useBreakpoint).mockReturnValue({
      layoutMode: 'compact',
      isCompact: true,
      isMedium: false,
      isExpanded: false,
      width: 400,
    });
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it('renders children correctly', () => {
    render(
      <MobileToolLayout>
        <div data-testid="child">Test Content</div>
      </MobileToolLayout>
    );

    expect(screen.getByTestId('child')).toBeInTheDocument();
    expect(screen.getByText('Test Content')).toBeInTheDocument();
  });

  it('applies vertical layout mode on compact viewport', () => {
    const { container } = render(
      <MobileToolLayout>
        <div>Content</div>
      </MobileToolLayout>
    );

    const layout = container.firstChild as HTMLElement;
    expect(layout).toHaveAttribute('data-layout-mode', 'vertical');
    expect(layout).toHaveClass('flex', 'flex-col', 'gap-4');
  });

  it('applies horizontal layout mode on expanded viewport', () => {
    vi.mocked(useBreakpoint).mockReturnValue({
      layoutMode: 'expanded',
      isCompact: false,
      isMedium: false,
      isExpanded: true,
      width: 1024,
    });

    const { container } = render(
      <MobileToolLayout>
        <div>Content</div>
      </MobileToolLayout>
    );

    const layout = container.firstChild as HTMLElement;
    expect(layout).toHaveAttribute('data-layout-mode', 'horizontal');
  });

  it('applies custom className', () => {
    const { container } = render(
      <MobileToolLayout className="custom-class">
        <div>Content</div>
      </MobileToolLayout>
    );

    expect(container.firstChild).toHaveClass('custom-class');
  });

  it('applies mobile padding on compact viewport', () => {
    const { container } = render(
      <MobileToolLayout>
        <div>Content</div>
      </MobileToolLayout>
    );

    expect(container.firstChild).toHaveClass('px-4', 'py-4');
  });
});

describe('MobileToolSection', () => {
  beforeEach(() => {
    vi.mocked(useBreakpoint).mockReturnValue({
      layoutMode: 'compact',
      isCompact: true,
      isMedium: false,
      isExpanded: false,
      width: 400,
    });
  });

  it('renders children correctly', () => {
    render(
      <MobileToolSection>
        <div data-testid="section-child">Section Content</div>
      </MobileToolSection>
    );

    expect(screen.getByTestId('section-child')).toBeInTheDocument();
  });

  it('applies correct data attribute for section type', () => {
    const { container } = render(
      <MobileToolSection type="input">
        <div>Input Section</div>
      </MobileToolSection>
    );

    expect(container.firstChild).toHaveAttribute('data-section-type', 'input');
  });

  it('applies order classes based on section type', () => {
    const { rerender, container } = render(
      <MobileToolSection type="input">
        <div>Content</div>
      </MobileToolSection>
    );
    expect(container.firstChild).toHaveClass('order-1');

    rerender(
      <MobileToolSection type="output">
        <div>Content</div>
      </MobileToolSection>
    );
    expect(container.firstChild).toHaveClass('order-2');

    rerender(
      <MobileToolSection type="actions">
        <div>Content</div>
      </MobileToolSection>
    );
    expect(container.firstChild).toHaveClass('order-3');
  });

  it('applies full width on compact viewport', () => {
    const { container } = render(
      <MobileToolSection>
        <div>Content</div>
      </MobileToolSection>
    );

    expect(container.firstChild).toHaveClass('w-full', 'max-w-full');
  });
});

describe('MobileToolActions', () => {
  beforeEach(() => {
    vi.mocked(useBreakpoint).mockReturnValue({
      layoutMode: 'compact',
      isCompact: true,
      isMedium: false,
      isExpanded: false,
      width: 400,
    });
  });

  it('renders children correctly', () => {
    render(
      <MobileToolActions>
        <button data-testid="action-btn">Action</button>
      </MobileToolActions>
    );

    expect(screen.getByTestId('action-btn')).toBeInTheDocument();
  });

  it('applies full-width styling to buttons on compact viewport', () => {
    render(
      <MobileToolActions>
        <button data-testid="action-btn">Action</button>
      </MobileToolActions>
    );

    const button = screen.getByTestId('action-btn');
    expect(button).toHaveClass('w-full');
  });

  it('applies flex column layout on compact viewport', () => {
    const { container } = render(
      <MobileToolActions>
        <button>Action 1</button>
        <button>Action 2</button>
      </MobileToolActions>
    );

    expect(container.firstChild).toHaveClass('flex', 'flex-col', 'gap-3');
  });

  it('applies sticky positioning when sticky prop is true', () => {
    const { container } = render(
      <MobileToolActions sticky>
        <button>Action</button>
      </MobileToolActions>
    );

    expect(container.firstChild).toHaveClass('sticky', 'bottom-0');
    expect(container.firstChild).toHaveAttribute('data-sticky', 'true');
  });

  it('does not apply full-width to buttons on expanded viewport', () => {
    vi.mocked(useBreakpoint).mockReturnValue({
      layoutMode: 'expanded',
      isCompact: false,
      isMedium: false,
      isExpanded: true,
      width: 1024,
    });

    render(
      <MobileToolActions>
        <button data-testid="action-btn" className="original-class">Action</button>
      </MobileToolActions>
    );

    const button = screen.getByTestId('action-btn');
    expect(button).toHaveClass('original-class');
    expect(button).not.toHaveClass('w-full');
  });
});
