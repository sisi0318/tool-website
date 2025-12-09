/**
 * Unit Tests for M3 Navigation Bar Component
 * 
 * Tests item selection, indicator animation, and accessibility.
 * Requirements: 4.4, 14.1, 14.2, 13.3
 */

import * as React from 'react';
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent, act } from '@testing-library/react';
import { M3NavigationBar, type NavigationItem } from './navigation-bar';

// Mock for testing ripple effect timing
vi.useFakeTimers();

// Test icons
const HomeIcon = () => <svg data-testid="home-icon" />;
const SearchIcon = () => <svg data-testid="search-icon" />;
const SettingsIcon = () => <svg data-testid="settings-icon" />;
const HomeFilledIcon = () => <svg data-testid="home-filled-icon" />;

const mockItems: NavigationItem[] = [
  { id: 'home', label: 'Home', icon: <HomeIcon />, activeIcon: <HomeFilledIcon /> },
  { id: 'search', label: 'Search', icon: <SearchIcon /> },
  { id: 'settings', label: 'Settings', icon: <SettingsIcon /> },
];

describe('M3NavigationBar Component', () => {
  describe('Rendering', () => {
    it('renders navigation bar with all items', () => {
      render(
        <M3NavigationBar
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

    it('renders with correct height (80dp)', () => {
      render(
        <M3NavigationBar
          items={mockItems}
          activeItem="home"
          onItemClick={() => {}}
        />
      );
      
      const nav = screen.getByRole('navigation');
      expect(nav).toHaveClass('h-20'); // 80px = 80dp
    });

    it('renders with fixed positioning at bottom', () => {
      render(
        <M3NavigationBar
          items={mockItems}
          activeItem="home"
          onItemClick={() => {}}
        />
      );
      
      const nav = screen.getByRole('navigation');
      expect(nav).toHaveClass('fixed');
      expect(nav).toHaveClass('bottom-0');
    });

    it('limits items to maximum 5', () => {
      const manyItems: NavigationItem[] = [
        { id: '1', label: 'Item 1', icon: <HomeIcon /> },
        { id: '2', label: 'Item 2', icon: <HomeIcon /> },
        { id: '3', label: 'Item 3', icon: <HomeIcon /> },
        { id: '4', label: 'Item 4', icon: <HomeIcon /> },
        { id: '5', label: 'Item 5', icon: <HomeIcon /> },
        { id: '6', label: 'Item 6', icon: <HomeIcon /> },
      ];
      
      render(
        <M3NavigationBar
          items={manyItems}
          activeItem="1"
          onItemClick={() => {}}
        />
      );
      
      // Should only render 5 items
      expect(screen.getByText('Item 1')).toBeInTheDocument();
      expect(screen.getByText('Item 5')).toBeInTheDocument();
      expect(screen.queryByText('Item 6')).not.toBeInTheDocument();
    });
  });

  describe('Item Selection', () => {
    it('calls onItemClick when item is clicked', () => {
      const handleClick = vi.fn();
      render(
        <M3NavigationBar
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
        <M3NavigationBar
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
        <M3NavigationBar
          items={mockItems}
          activeItem="home"
          onItemClick={() => {}}
        />
      );
      
      // Home should show filled icon (active)
      expect(screen.getByTestId('home-filled-icon')).toBeInTheDocument();
      expect(screen.queryByTestId('home-icon')).not.toBeInTheDocument();
    });

    it('shows regular icon when item is not active', () => {
      render(
        <M3NavigationBar
          items={mockItems}
          activeItem="search"
          onItemClick={() => {}}
        />
      );
      
      // Home should show regular icon (not active)
      expect(screen.getByTestId('home-icon')).toBeInTheDocument();
      expect(screen.queryByTestId('home-filled-icon')).not.toBeInTheDocument();
    });
  });

  describe('Indicator Animation', () => {
    it('shows indicator for active item', () => {
      render(
        <M3NavigationBar
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
        <M3NavigationBar
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

  describe('Touch Target Size', () => {
    it('has minimum 48dp touch target', () => {
      render(
        <M3NavigationBar
          items={mockItems}
          activeItem="home"
          onItemClick={() => {}}
        />
      );
      
      const homeButton = screen.getByLabelText('Home');
      expect(homeButton).toHaveClass('min-w-[48px]');
      expect(homeButton).toHaveClass('min-h-[48px]');
    });
  });

  describe('Badge Support', () => {
    it('renders dot badge when badge is true', () => {
      const itemsWithBadge: NavigationItem[] = [
        { id: 'home', label: 'Home', icon: <HomeIcon />, badge: true },
      ];
      
      render(
        <M3NavigationBar
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
        <M3NavigationBar
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
        <M3NavigationBar
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
        <M3NavigationBar
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
        <M3NavigationBar
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
        <M3NavigationBar
          items={mockItems}
          activeItem="home"
          onItemClick={() => {}}
        />
      );
      
      expect(screen.getByRole('navigation')).toBeInTheDocument();
    });

    it('has aria-label for navigation', () => {
      render(
        <M3NavigationBar
          items={mockItems}
          activeItem="home"
          onItemClick={() => {}}
        />
      );
      
      expect(screen.getByRole('navigation')).toHaveAttribute('aria-label', 'Main navigation');
    });

    it('items have aria-label', () => {
      render(
        <M3NavigationBar
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
        <M3NavigationBar
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
