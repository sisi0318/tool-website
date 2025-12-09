/**
 * Unit Tests for M3 Navigation Rail Component
 * 
 * Tests item selection, indicator animation, FAB placement, and accessibility.
 * Requirements: 4.4, 6.2, 6.3
 */

import * as React from 'react';
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent, act } from '@testing-library/react';
import { M3NavigationRail } from './navigation-rail';
import type { NavigationItem } from './navigation-bar';

// Mock for testing ripple effect timing
vi.useFakeTimers();

// Test icons
const HomeIcon = () => <svg data-testid="home-icon" />;
const SearchIcon = () => <svg data-testid="search-icon" />;
const SettingsIcon = () => <svg data-testid="settings-icon" />;
const HomeFilledIcon = () => <svg data-testid="home-filled-icon" />;
const AddIcon = () => <svg data-testid="add-icon" />;

const mockItems: NavigationItem[] = [
  { id: 'home', label: 'Home', icon: <HomeIcon />, activeIcon: <HomeFilledIcon /> },
  { id: 'search', label: 'Search', icon: <SearchIcon /> },
  { id: 'settings', label: 'Settings', icon: <SettingsIcon /> },
];

describe('M3NavigationRail Component', () => {
  describe('Rendering', () => {
    it('renders navigation rail with all items', () => {
      render(
        <M3NavigationRail
          items={mockItems}
          activeItem="home"
          onItemClick={() => {}}
        />
      );
      
      expect(screen.getByRole('navigation')).toBeInTheDocument();
      expect(screen.getByText('Home')).toBeInTheDocument();
      expect(screen.getByText('Search')).toBeInTheDocument();
      expect(screen.getByText('Settings')).toBeInTheDocument();
    });

    it('renders with correct width (80dp)', () => {
      render(
        <M3NavigationRail
          items={mockItems}
          activeItem="home"
          onItemClick={() => {}}
        />
      );
      
      const nav = screen.getByRole('navigation');
      expect(nav).toHaveClass('w-20'); // 80px = 80dp
    });

    it('renders with fixed positioning on left', () => {
      render(
        <M3NavigationRail
          items={mockItems}
          activeItem="home"
          onItemClick={() => {}}
        />
      );
      
      const nav = screen.getByRole('navigation');
      expect(nav).toHaveClass('fixed');
      expect(nav).toHaveClass('left-0');
      expect(nav).toHaveClass('top-0');
      expect(nav).toHaveClass('bottom-0');
    });

    it('renders labels by default', () => {
      render(
        <M3NavigationRail
          items={mockItems}
          activeItem="home"
          onItemClick={() => {}}
        />
      );
      
      expect(screen.getByText('Home')).toBeInTheDocument();
      expect(screen.getByText('Search')).toBeInTheDocument();
    });

    it('hides labels when showLabels is false', () => {
      render(
        <M3NavigationRail
          items={mockItems}
          activeItem="home"
          onItemClick={() => {}}
          showLabels={false}
        />
      );
      
      // Labels should not be visible (only aria-label on buttons)
      expect(screen.queryByText('Home')).not.toBeInTheDocument();
      expect(screen.queryByText('Search')).not.toBeInTheDocument();
    });
  });

  describe('FAB Placement', () => {
    it('renders FAB when provided', () => {
      const fab = <button data-testid="fab"><AddIcon /></button>;
      
      render(
        <M3NavigationRail
          items={mockItems}
          activeItem="home"
          onItemClick={() => {}}
          fab={fab}
        />
      );
      
      expect(screen.getByTestId('fab')).toBeInTheDocument();
      expect(screen.getByTestId('add-icon')).toBeInTheDocument();
    });

    it('positions FAB at top of rail', () => {
      const fab = <button data-testid="fab"><AddIcon /></button>;
      
      render(
        <M3NavigationRail
          items={mockItems}
          activeItem="home"
          onItemClick={() => {}}
          fab={fab}
        />
      );
      
      const nav = screen.getByRole('navigation');
      const fabContainer = screen.getByTestId('fab').parentElement;
      
      // FAB container should be before the items container
      const children = Array.from(nav.children);
      const fabIndex = children.indexOf(fabContainer!);
      expect(fabIndex).toBe(0);
    });
  });

  describe('Item Selection', () => {
    it('calls onItemClick when item is clicked', () => {
      const handleClick = vi.fn();
      render(
        <M3NavigationRail
          items={mockItems}
          activeItem="home"
          onItemClick={handleClick}
        />
      );
      
      fireEvent.click(screen.getByLabelText('Search'));
      expect(handleClick).toHaveBeenCalledWith('search');
    });

    it('marks active item with aria-current', () => {
      render(
        <M3NavigationRail
          items={mockItems}
          activeItem="home"
          onItemClick={() => {}}
        />
      );
      
      expect(screen.getByLabelText('Home')).toHaveAttribute('aria-current', 'page');
      expect(screen.getByLabelText('Search')).not.toHaveAttribute('aria-current');
    });

    it('shows active icon when item is active', () => {
      render(
        <M3NavigationRail
          items={mockItems}
          activeItem="home"
          onItemClick={() => {}}
        />
      );
      
      expect(screen.getByTestId('home-filled-icon')).toBeInTheDocument();
      expect(screen.queryByTestId('home-icon')).not.toBeInTheDocument();
    });

    it('shows regular icon when item is not active', () => {
      render(
        <M3NavigationRail
          items={mockItems}
          activeItem="search"
          onItemClick={() => {}}
        />
      );
      
      expect(screen.getByTestId('home-icon')).toBeInTheDocument();
      expect(screen.queryByTestId('home-filled-icon')).not.toBeInTheDocument();
    });
  });

  describe('Indicator Animation', () => {
    it('shows indicator for active item', () => {
      render(
        <M3NavigationRail
          items={mockItems}
          activeItem="home"
          onItemClick={() => {}}
        />
      );
      
      const homeButton = screen.getByLabelText('Home');
      const indicator = homeButton.querySelector('.bg-\\[var\\(--md-sys-color-secondary-container\\)\\]');
      
      expect(indicator).toHaveClass('opacity-100');
      expect(indicator).toHaveClass('scale-100');
    });

    it('hides indicator for inactive items', () => {
      render(
        <M3NavigationRail
          items={mockItems}
          activeItem="home"
          onItemClick={() => {}}
        />
      );
      
      const searchButton = screen.getByLabelText('Search');
      const indicator = searchButton.querySelector('.bg-\\[var\\(--md-sys-color-secondary-container\\)\\]');
      
      expect(indicator).toHaveClass('opacity-0');
      expect(indicator).toHaveClass('scale-75');
    });
  });

  describe('Alignment', () => {
    it('aligns items to top by default', () => {
      render(
        <M3NavigationRail
          items={mockItems}
          activeItem="home"
          onItemClick={() => {}}
        />
      );
      
      const nav = screen.getByRole('navigation');
      const itemsContainer = nav.querySelector('.flex-1');
      expect(itemsContainer).toHaveClass('justify-start');
    });

    it('aligns items to center when specified', () => {
      render(
        <M3NavigationRail
          items={mockItems}
          activeItem="home"
          onItemClick={() => {}}
          alignment="center"
        />
      );
      
      const nav = screen.getByRole('navigation');
      const itemsContainer = nav.querySelector('.flex-1');
      expect(itemsContainer).toHaveClass('justify-center');
    });

    it('aligns items to bottom when specified', () => {
      render(
        <M3NavigationRail
          items={mockItems}
          activeItem="home"
          onItemClick={() => {}}
          alignment="bottom"
        />
      );
      
      const nav = screen.getByRole('navigation');
      const itemsContainer = nav.querySelector('.flex-1');
      expect(itemsContainer).toHaveClass('justify-end');
    });
  });

  describe('Badge Support', () => {
    it('renders dot badge when badge is true', () => {
      const itemsWithBadge: NavigationItem[] = [
        { id: 'home', label: 'Home', icon: <HomeIcon />, badge: true },
      ];
      
      render(
        <M3NavigationRail
          items={itemsWithBadge}
          activeItem="home"
          onItemClick={() => {}}
        />
      );
      
      const badge = screen.getByLabelText('Home').querySelector('.bg-\\[var\\(--md-sys-color-error\\)\\]');
      expect(badge).toBeInTheDocument();
      expect(badge).toHaveClass('w-2');
      expect(badge).toHaveClass('h-2');
    });

    it('renders count badge with number', () => {
      const itemsWithBadge: NavigationItem[] = [
        { id: 'home', label: 'Home', icon: <HomeIcon />, badge: 5 },
      ];
      
      render(
        <M3NavigationRail
          items={itemsWithBadge}
          activeItem="home"
          onItemClick={() => {}}
        />
      );
      
      expect(screen.getByText('5')).toBeInTheDocument();
    });

    it('shows 99+ for badge count over 99', () => {
      const itemsWithBadge: NavigationItem[] = [
        { id: 'home', label: 'Home', icon: <HomeIcon />, badge: 150 },
      ];
      
      render(
        <M3NavigationRail
          items={itemsWithBadge}
          activeItem="home"
          onItemClick={() => {}}
        />
      );
      
      expect(screen.getByText('99+')).toBeInTheDocument();
    });
  });

  describe('Ripple Effect', () => {
    it('creates ripple on click', () => {
      render(
        <M3NavigationRail
          items={mockItems}
          activeItem="home"
          onItemClick={() => {}}
        />
      );
      
      const homeButton = screen.getByLabelText('Home');
      fireEvent.click(homeButton, { clientX: 50, clientY: 25 });
      
      const ripple = homeButton.querySelector('.animate-ripple');
      expect(ripple).toBeInTheDocument();
    });

    it('removes ripple after animation', async () => {
      render(
        <M3NavigationRail
          items={mockItems}
          activeItem="home"
          onItemClick={() => {}}
        />
      );
      
      const homeButton = screen.getByLabelText('Home');
      fireEvent.click(homeButton, { clientX: 50, clientY: 25 });
      
      expect(homeButton.querySelector('.animate-ripple')).toBeInTheDocument();
      
      await act(async () => {
        vi.advanceTimersByTime(600);
      });
      
      expect(homeButton.querySelector('.animate-ripple')).not.toBeInTheDocument();
    });
  });

  describe('Accessibility', () => {
    it('has navigation role', () => {
      render(
        <M3NavigationRail
          items={mockItems}
          activeItem="home"
          onItemClick={() => {}}
        />
      );
      
      expect(screen.getByRole('navigation')).toBeInTheDocument();
    });

    it('has aria-label for navigation', () => {
      render(
        <M3NavigationRail
          items={mockItems}
          activeItem="home"
          onItemClick={() => {}}
        />
      );
      
      expect(screen.getByRole('navigation')).toHaveAttribute('aria-label', 'Main navigation');
    });

    it('items have aria-label', () => {
      render(
        <M3NavigationRail
          items={mockItems}
          activeItem="home"
          onItemClick={() => {}}
        />
      );
      
      expect(screen.getByLabelText('Home')).toBeInTheDocument();
      expect(screen.getByLabelText('Search')).toBeInTheDocument();
      expect(screen.getByLabelText('Settings')).toBeInTheDocument();
    });
  });

  describe('Custom className', () => {
    it('applies custom className', () => {
      render(
        <M3NavigationRail
          items={mockItems}
          activeItem="home"
          onItemClick={() => {}}
          className="custom-class"
        />
      );
      
      expect(screen.getByRole('navigation')).toHaveClass('custom-class');
    });
  });
});
