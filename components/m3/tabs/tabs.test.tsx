/**
 * Unit Tests for M3 Tabs Component
 * 
 * Tests tab selection and indicator animation, tab add/remove behavior.
 * Requirements: 4.5, 9.1, 9.2, 9.3, 9.4
 */

import * as React from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, act, waitFor } from '@testing-library/react';
import { M3Tabs, type TabItem } from './tabs';
import { M3Tab } from './tab';

// Mock for testing animation timing
vi.useFakeTimers();

const mockTabs: TabItem[] = [
  { id: 'tab1', label: 'Tab 1' },
  { id: 'tab2', label: 'Tab 2' },
  { id: 'tab3', label: 'Tab 3' },
];

describe('M3Tabs Component', () => {
  beforeEach(() => {
    vi.clearAllTimers();
  });

  afterEach(() => {
    vi.clearAllTimers();
  });

  describe('Basic Rendering', () => {
    it('renders all tabs', () => {
      render(
        <M3Tabs
          tabs={mockTabs}
          activeTab="tab1"
          onTabChange={() => {}}
        />
      );
      
      expect(screen.getByRole('tab', { name: /tab 1/i })).toBeInTheDocument();
      expect(screen.getByRole('tab', { name: /tab 2/i })).toBeInTheDocument();
      expect(screen.getByRole('tab', { name: /tab 3/i })).toBeInTheDocument();
    });

    it('renders with tablist role', () => {
      render(
        <M3Tabs
          tabs={mockTabs}
          activeTab="tab1"
          onTabChange={() => {}}
        />
      );
      
      expect(screen.getByRole('tablist')).toBeInTheDocument();
    });

    it('applies custom className', () => {
      render(
        <M3Tabs
          tabs={mockTabs}
          activeTab="tab1"
          onTabChange={() => {}}
          className="custom-class"
        />
      );
      
      expect(screen.getByRole('tablist')).toHaveClass('custom-class');
    });
  });

  describe('Tab Selection', () => {
    it('marks active tab with aria-selected', () => {
      render(
        <M3Tabs
          tabs={mockTabs}
          activeTab="tab2"
          onTabChange={() => {}}
        />
      );
      
      expect(screen.getByRole('tab', { name: /tab 1/i })).toHaveAttribute('aria-selected', 'false');
      expect(screen.getByRole('tab', { name: /tab 2/i })).toHaveAttribute('aria-selected', 'true');
      expect(screen.getByRole('tab', { name: /tab 3/i })).toHaveAttribute('aria-selected', 'false');
    });

    it('calls onTabChange when tab is clicked', () => {
      const handleTabChange = vi.fn();
      render(
        <M3Tabs
          tabs={mockTabs}
          activeTab="tab1"
          onTabChange={handleTabChange}
        />
      );
      
      fireEvent.click(screen.getByRole('tab', { name: /tab 2/i }));
      expect(handleTabChange).toHaveBeenCalledWith('tab2');
    });

    it('updates active tab styling when activeTab prop changes', () => {
      const { rerender } = render(
        <M3Tabs
          tabs={mockTabs}
          activeTab="tab1"
          onTabChange={() => {}}
        />
      );
      
      expect(screen.getByRole('tab', { name: /tab 1/i })).toHaveAttribute('data-active', 'true');
      
      rerender(
        <M3Tabs
          tabs={mockTabs}
          activeTab="tab2"
          onTabChange={() => {}}
        />
      );
      
      expect(screen.getByRole('tab', { name: /tab 1/i })).toHaveAttribute('data-active', 'false');
      expect(screen.getByRole('tab', { name: /tab 2/i })).toHaveAttribute('data-active', 'true');
    });
  });

  describe('Indicator Animation', () => {
    it('renders indicator element', () => {
      const { container } = render(
        <M3Tabs
          tabs={mockTabs}
          activeTab="tab1"
          onTabChange={() => {}}
        />
      );
      
      // Primary variant has a bottom indicator
      const indicator = container.querySelector('.bg-\\[var\\(--md-sys-color-primary\\)\\]');
      expect(indicator).toBeInTheDocument();
    });

    it('renders secondary variant indicator', () => {
      const { container } = render(
        <M3Tabs
          tabs={mockTabs}
          activeTab="tab1"
          onTabChange={() => {}}
          variant="secondary"
        />
      );
      
      // Secondary variant has a full background indicator
      const indicator = container.querySelector('.bg-\\[var\\(--md-sys-color-secondary-container\\)\\]');
      expect(indicator).toBeInTheDocument();
    });
  });

  describe('Tab Variants', () => {
    it('renders primary variant tabs', () => {
      render(
        <M3Tabs
          tabs={mockTabs}
          activeTab="tab1"
          onTabChange={() => {}}
          variant="primary"
        />
      );
      
      const activeTab = screen.getByRole('tab', { name: /tab 1/i });
      expect(activeTab).toHaveClass('data-[active=true]:text-[var(--md-sys-color-primary)]');
    });

    it('renders secondary variant tabs', () => {
      render(
        <M3Tabs
          tabs={mockTabs}
          activeTab="tab1"
          onTabChange={() => {}}
          variant="secondary"
        />
      );
      
      const activeTab = screen.getByRole('tab', { name: /tab 1/i });
      expect(activeTab).toHaveClass('data-[active=true]:text-[var(--md-sys-color-on-surface)]');
    });
  });

  describe('Tab Close Behavior', () => {
    it('renders close button for closable tabs', () => {
      const closableTabs: TabItem[] = [
        { id: 'tab1', label: 'Tab 1', closable: true },
        { id: 'tab2', label: 'Tab 2', closable: false },
      ];
      
      render(
        <M3Tabs
          tabs={closableTabs}
          activeTab="tab1"
          onTabChange={() => {}}
        />
      );
      
      // Tab 1 should have close button (span with role="button")
      const closeButtons = screen.getAllByLabelText(/close tab/i);
      expect(closeButtons).toHaveLength(1);
    });

    it('calls onTabClose when close button is clicked', async () => {
      const handleTabClose = vi.fn();
      const closableTabs: TabItem[] = [
        { id: 'tab1', label: 'Tab 1', closable: true },
      ];
      
      render(
        <M3Tabs
          tabs={closableTabs}
          activeTab="tab1"
          onTabChange={() => {}}
          onTabClose={handleTabClose}
        />
      );
      
      const closeButton = screen.getByLabelText(/close tab/i);
      fireEvent.click(closeButton);
      
      // Wait for exit animation (200ms)
      await act(async () => {
        vi.advanceTimersByTime(200);
      });
      
      expect(handleTabClose).toHaveBeenCalledWith('tab1');
    });

    it('does not trigger tab selection when close button is clicked', () => {
      const handleTabChange = vi.fn();
      const closableTabs: TabItem[] = [
        { id: 'tab1', label: 'Tab 1', closable: true },
        { id: 'tab2', label: 'Tab 2' },
      ];
      
      render(
        <M3Tabs
          tabs={closableTabs}
          activeTab="tab2"
          onTabChange={handleTabChange}
          onTabClose={() => {}}
        />
      );
      
      const closeButton = screen.getByLabelText(/close tab/i);
      fireEvent.click(closeButton);
      
      // onTabChange should not be called
      expect(handleTabChange).not.toHaveBeenCalled();
    });
  });

  describe('Tab with Icons', () => {
    it('renders tabs with icons', () => {
      const tabsWithIcons: TabItem[] = [
        { id: 'tab1', label: 'Tab 1', icon: <span data-testid="icon-1">Icon</span> },
      ];
      
      render(
        <M3Tabs
          tabs={tabsWithIcons}
          activeTab="tab1"
          onTabChange={() => {}}
        />
      );
      
      expect(screen.getByTestId('icon-1')).toBeInTheDocument();
    });
  });

  describe('Disabled Tabs', () => {
    it('renders disabled tabs', () => {
      const tabsWithDisabled: TabItem[] = [
        { id: 'tab1', label: 'Tab 1' },
        { id: 'tab2', label: 'Tab 2', disabled: true },
      ];
      
      render(
        <M3Tabs
          tabs={tabsWithDisabled}
          activeTab="tab1"
          onTabChange={() => {}}
        />
      );
      
      expect(screen.getByRole('tab', { name: /tab 2/i })).toBeDisabled();
    });
  });

  describe('Scrollable Tabs', () => {
    it('applies scrollable styles when scrollable is true', () => {
      render(
        <M3Tabs
          tabs={mockTabs}
          activeTab="tab1"
          onTabChange={() => {}}
          scrollable
        />
      );
      
      expect(screen.getByRole('tablist')).toHaveClass('overflow-x-auto');
    });
  });
});

describe('M3Tab Component', () => {
  describe('Basic Rendering', () => {
    it('renders tab with label', () => {
      render(<M3Tab>Test Tab</M3Tab>);
      expect(screen.getByRole('tab', { name: /test tab/i })).toBeInTheDocument();
    });

    it('renders with correct role', () => {
      render(<M3Tab>Test Tab</M3Tab>);
      expect(screen.getByRole('tab')).toBeInTheDocument();
    });
  });

  describe('Active State', () => {
    it('sets aria-selected when active', () => {
      render(<M3Tab isActive>Active Tab</M3Tab>);
      expect(screen.getByRole('tab')).toHaveAttribute('aria-selected', 'true');
    });

    it('sets data-active attribute when active', () => {
      render(<M3Tab isActive>Active Tab</M3Tab>);
      expect(screen.getByRole('tab')).toHaveAttribute('data-active', 'true');
    });
  });

  describe('Ripple Effect', () => {
    it('creates ripple on click', () => {
      render(<M3Tab>Ripple Tab</M3Tab>);
      const tab = screen.getByRole('tab');
      
      fireEvent.click(tab, { clientX: 50, clientY: 25 });
      
      const ripple = tab.querySelector('.animate-ripple');
      expect(ripple).toBeInTheDocument();
    });

    it('removes ripple after animation', async () => {
      render(<M3Tab>Ripple Tab</M3Tab>);
      const tab = screen.getByRole('tab');
      
      fireEvent.click(tab, { clientX: 50, clientY: 25 });
      expect(tab.querySelector('.animate-ripple')).toBeInTheDocument();
      
      await act(async () => {
        vi.advanceTimersByTime(600);
      });
      
      expect(tab.querySelector('.animate-ripple')).not.toBeInTheDocument();
    });
  });

  describe('Click Handler', () => {
    it('calls onClick when clicked', () => {
      const handleClick = vi.fn();
      render(<M3Tab onClick={handleClick}>Click Tab</M3Tab>);
      
      fireEvent.click(screen.getByRole('tab'));
      expect(handleClick).toHaveBeenCalledTimes(1);
    });
  });
});
