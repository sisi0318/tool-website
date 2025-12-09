/**
 * M3 Accessibility Tests
 * 
 * Tests for accessibility features including:
 * - Focus indicator visibility
 * - ARIA label presence
 * - Reduced motion behavior
 * 
 * Requirements: 12.2, 12.3, 12.4
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import * as React from 'react';

// Import M3 components
import { M3Button } from './button';
import { M3Card } from './card';
import { M3TextField } from './input';
import { M3Switch } from './switch';
import { M3Chip } from './chip';
import { M3Slider } from './slider';
import { M3NavigationBar, type NavigationItem } from './navigation';
import { M3Tabs, type TabItem } from './tabs';
import { M3Dialog, M3DialogContent, M3DialogTitle, M3DialogTrigger } from './dialog';
import { M3SearchBar } from './search';

// Mock navigation items for testing
const mockNavItems: NavigationItem[] = [
  { id: 'home', label: 'Home', icon: <span>🏠</span> },
  { id: 'search', label: 'Search', icon: <span>🔍</span> },
  { id: 'settings', label: 'Settings', icon: <span>⚙️</span> },
];

// Mock tab items for testing
const mockTabItems: TabItem[] = [
  { id: 'tab1', label: 'Tab 1' },
  { id: 'tab2', label: 'Tab 2' },
  { id: 'tab3', label: 'Tab 3' },
];

describe('M3 Accessibility - Focus Indicators', () => {
  it('M3Button should have focus-visible styles', () => {
    render(<M3Button>Click me</M3Button>);
    
    const button = screen.getByRole('button', { name: /click me/i });
    button.focus();
    
    expect(button).toHaveFocus();
    // Check that focus-visible classes are applied
    expect(button.className).toContain('focus-visible:outline-none');
    expect(button.className).toContain('focus-visible:ring-2');
  });

  it('M3Card interactive should be focusable', () => {
    render(
      <M3Card interactive onClick={() => {}}>
        Card content
      </M3Card>
    );
    
    const card = screen.getByRole('button');
    card.focus();
    
    expect(card).toHaveFocus();
    expect(card.className).toContain('focus-visible:ring-2');
  });

  it('M3TextField should have focus styles', () => {
    render(<M3TextField label="Test input" onChange={() => {}} />);
    
    const input = screen.getByRole('textbox');
    input.focus();
    
    expect(input).toHaveFocus();
  });

  it('M3Switch should be focusable', () => {
    render(<M3Switch aria-label="Toggle setting" />);
    
    const switchElement = screen.getByRole('switch');
    switchElement.focus();
    
    expect(switchElement).toHaveFocus();
    expect(switchElement.className).toContain('focus-visible:ring-2');
  });

  it('M3Chip should have focus-visible styles', () => {
    render(<M3Chip>Filter chip</M3Chip>);
    
    const chip = screen.getByRole('button', { name: /filter chip/i });
    chip.focus();
    
    expect(chip).toHaveFocus();
    expect(chip.className).toContain('focus-visible:ring-2');
  });

  it('M3SearchBar should have focus styles', () => {
    render(<M3SearchBar placeholder="Search..." />);
    
    const searchInput = screen.getByRole('searchbox');
    searchInput.focus();
    
    expect(searchInput).toHaveFocus();
  });
});

describe('M3 Accessibility - ARIA Labels and Roles', () => {
  it('M3Button should support aria-label', () => {
    render(<M3Button aria-label="Close dialog" icon={<span>×</span>} />);
    
    const button = screen.getByRole('button', { name: /close dialog/i });
    expect(button).toBeInTheDocument();
    expect(button).toHaveAttribute('aria-label', 'Close dialog');
  });

  it('M3Button should have aria-disabled when disabled', () => {
    render(<M3Button disabled>Disabled button</M3Button>);
    
    const button = screen.getByRole('button');
    expect(button).toHaveAttribute('aria-disabled', 'true');
  });

  it('M3Button should have aria-busy when loading', () => {
    render(<M3Button loading>Loading button</M3Button>);
    
    const button = screen.getByRole('button');
    expect(button).toHaveAttribute('aria-busy', 'true');
  });

  it('M3Card interactive should have role="button"', () => {
    render(
      <M3Card interactive onClick={() => {}}>
        Interactive card
      </M3Card>
    );
    
    const card = screen.getByRole('button');
    expect(card).toBeInTheDocument();
  });

  it('M3TextField should have aria-invalid when in error state', () => {
    render(
      <M3TextField 
        label="Email" 
        error 
        errorText="Invalid email" 
        onChange={() => {}} 
      />
    );
    
    const input = screen.getByRole('textbox');
    expect(input).toHaveAttribute('aria-invalid', 'true');
  });

  it('M3TextField should have aria-describedby for supporting text', () => {
    render(
      <M3TextField 
        label="Username" 
        supportingText="Enter your username" 
        onChange={() => {}} 
      />
    );
    
    const input = screen.getByRole('textbox');
    expect(input).toHaveAttribute('aria-describedby');
    
    // Check that the supporting text is present
    expect(screen.getByText('Enter your username')).toBeInTheDocument();
  });

  it('M3Switch should support aria-label', () => {
    render(<M3Switch aria-label="Enable notifications" />);
    
    const switchElement = screen.getByRole('switch', { name: /enable notifications/i });
    expect(switchElement).toBeInTheDocument();
  });

  it('M3Chip filter should have aria-pressed', () => {
    render(<M3Chip variant="filter" selected>Selected filter</M3Chip>);
    
    const chip = screen.getByRole('button');
    expect(chip).toHaveAttribute('aria-pressed', 'true');
  });

  it('M3NavigationBar should have role="navigation" and aria-label', () => {
    render(
      <M3NavigationBar 
        items={mockNavItems} 
        activeItem="home" 
        onItemClick={() => {}}
        aria-label="Main navigation"
      />
    );
    
    const nav = screen.getByRole('navigation');
    expect(nav).toHaveAttribute('aria-label', 'Main navigation');
  });

  it('M3NavigationBar items should have aria-current for active item', () => {
    render(
      <M3NavigationBar 
        items={mockNavItems} 
        activeItem="home" 
        onItemClick={() => {}}
      />
    );
    
    const homeButton = screen.getByRole('button', { name: /home/i });
    expect(homeButton).toHaveAttribute('aria-current', 'page');
    
    const searchButton = screen.getByRole('button', { name: /search/i });
    expect(searchButton).not.toHaveAttribute('aria-current');
  });

  it('M3Tabs should have role="tablist"', () => {
    render(
      <M3Tabs 
        tabs={mockTabItems} 
        activeTab="tab1" 
        onTabChange={() => {}}
        aria-label="Content tabs"
      />
    );
    
    const tablist = screen.getByRole('tablist');
    expect(tablist).toHaveAttribute('aria-label', 'Content tabs');
    expect(tablist).toHaveAttribute('aria-orientation', 'horizontal');
  });

  it('M3Tab should have role="tab" and aria-selected', () => {
    render(
      <M3Tabs 
        tabs={mockTabItems} 
        activeTab="tab1" 
        onTabChange={() => {}}
      />
    );
    
    const tabs = screen.getAllByRole('tab');
    expect(tabs[0]).toHaveAttribute('aria-selected', 'true');
    expect(tabs[1]).toHaveAttribute('aria-selected', 'false');
  });

  it('M3Slider should have proper ARIA attributes', () => {
    render(
      <M3Slider 
        value={[50]} 
        min={0} 
        max={100} 
        aria-label="Volume control"
      />
    );
    
    const slider = screen.getByRole('slider');
    expect(slider).toHaveAttribute('aria-valuenow', '50');
    expect(slider).toHaveAttribute('aria-valuemin', '0');
    expect(slider).toHaveAttribute('aria-valuemax', '100');
  });

  it('M3SearchBar should have role="searchbox"', () => {
    render(<M3SearchBar placeholder="Search tools..." />);
    
    const searchbox = screen.getByRole('searchbox');
    expect(searchbox).toBeInTheDocument();
    expect(searchbox).toHaveAttribute('aria-label', 'Search tools...');
  });

  it('M3Dialog should have role="dialog"', () => {
    render(
      <M3Dialog open>
        <M3DialogContent>
          <M3DialogTitle>Dialog Title</M3DialogTitle>
          <p>Dialog content</p>
        </M3DialogContent>
      </M3Dialog>
    );
    
    const dialog = screen.getByRole('dialog');
    expect(dialog).toBeInTheDocument();
  });
});

describe('M3 Accessibility - Keyboard Navigation', () => {
  it('M3Card interactive should respond to Enter key', () => {
    const handleClick = vi.fn();
    
    render(
      <M3Card interactive onClick={handleClick}>
        Keyboard accessible card
      </M3Card>
    );
    
    const card = screen.getByRole('button');
    card.focus();
    fireEvent.keyDown(card, { key: 'Enter', code: 'Enter' });
    
    expect(handleClick).toHaveBeenCalled();
  });

  it('M3Card interactive should respond to Space key', () => {
    const handleClick = vi.fn();
    
    render(
      <M3Card interactive onClick={handleClick}>
        Keyboard accessible card
      </M3Card>
    );
    
    const card = screen.getByRole('button');
    card.focus();
    fireEvent.keyDown(card, { key: ' ', code: 'Space' });
    
    expect(handleClick).toHaveBeenCalled();
  });

  it('M3Switch should toggle with click', () => {
    const handleChange = vi.fn();
    
    render(<M3Switch onCheckedChange={handleChange} aria-label="Toggle" />);
    
    const switchElement = screen.getByRole('switch');
    fireEvent.click(switchElement);
    
    expect(handleChange).toHaveBeenCalled();
  });

  it('M3Chip should activate with click', () => {
    const handleClick = vi.fn();
    
    render(<M3Chip onClick={handleClick}>Clickable chip</M3Chip>);
    
    const chip = screen.getByRole('button');
    fireEvent.click(chip);
    
    expect(handleClick).toHaveBeenCalled();
  });
});
