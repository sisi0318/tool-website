/**
 * Unit Tests for M3 TextField Component
 * 
 * Tests label animation states, error state display, and icon rendering.
 * Requirements: 4.3
 */

import * as React from 'react';
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { M3TextField } from './text-field';

describe('M3TextField Component', () => {
  describe('Variant Renderings', () => {
    it('renders filled variant with correct styles', () => {
      render(<M3TextField label="Test Label" variant="filled" />);
      const container = screen.getByRole('textbox').closest('div')?.parentElement;
      
      expect(container).toHaveClass('bg-[var(--md-sys-color-surface-container-highest)]');
      expect(container).toHaveClass('rounded-t-[var(--md-sys-shape-corner-extra-small)]');
    });

    it('renders outlined variant with correct styles', () => {
      render(<M3TextField label="Test Label" variant="outlined" />);
      const container = screen.getByRole('textbox').closest('div')?.parentElement;
      
      expect(container).toHaveClass('bg-transparent');
      expect(container).toHaveClass('rounded-[var(--md-sys-shape-corner-extra-small)]');
      expect(container).toHaveClass('border');
    });

    it('renders with default filled variant when no variant specified', () => {
      render(<M3TextField label="Test Label" />);
      const container = screen.getByRole('textbox').closest('div')?.parentElement;
      
      expect(container).toHaveClass('bg-[var(--md-sys-color-surface-container-highest)]');
    });
  });

  describe('Label Animation States', () => {
    it('renders label in default position when empty and not focused', () => {
      render(<M3TextField label="Test Label" />);
      const label = screen.getByText('Test Label');
      
      expect(label).toHaveClass('top-1/2');
      expect(label).toHaveClass('-translate-y-1/2');
    });

    it('floats label when input is focused', () => {
      render(<M3TextField label="Test Label" variant="filled" />);
      const input = screen.getByRole('textbox');
      const label = screen.getByText('Test Label');
      
      fireEvent.focus(input);
      
      expect(label).toHaveClass('top-2');
      expect(label).toHaveClass('text-xs');
    });

    it('floats label when input has value', () => {
      render(<M3TextField label="Test Label" variant="filled" value="Some text" />);
      const label = screen.getByText('Test Label');
      
      expect(label).toHaveClass('top-2');
      expect(label).toHaveClass('text-xs');
    });

    it('keeps label floated after blur if input has value', () => {
      render(<M3TextField label="Test Label" variant="filled" />);
      const input = screen.getByRole('textbox');
      const label = screen.getByText('Test Label');
      
      fireEvent.focus(input);
      fireEvent.change(input, { target: { value: 'Test value' } });
      fireEvent.blur(input);
      
      expect(label).toHaveClass('top-2');
      expect(label).toHaveClass('text-xs');
    });

    it('returns label to default position after blur if input is empty', () => {
      render(<M3TextField label="Test Label" variant="filled" />);
      const input = screen.getByRole('textbox');
      const label = screen.getByText('Test Label');
      
      fireEvent.focus(input);
      fireEvent.blur(input);
      
      expect(label).toHaveClass('top-1/2');
      expect(label).toHaveClass('-translate-y-1/2');
    });

    it('applies primary color to label when focused (non-error)', () => {
      render(<M3TextField label="Test Label" />);
      const input = screen.getByRole('textbox');
      const label = screen.getByText('Test Label');
      
      fireEvent.focus(input);
      
      expect(label).toHaveClass('text-[var(--md-sys-color-primary)]');
    });

    it('floats outlined label with background for notch effect', () => {
      render(<M3TextField label="Test Label" variant="outlined" value="text" />);
      const label = screen.getByText('Test Label');
      
      expect(label).toHaveClass('bg-[var(--md-sys-color-surface)]');
      expect(label).toHaveClass('px-1');
    });
  });


  describe('Error State Display', () => {
    it('displays error text when provided', () => {
      render(<M3TextField label="Test Label" errorText="This field is required" />);
      
      expect(screen.getByText('This field is required')).toBeInTheDocument();
    });

    it('applies error color to error text', () => {
      render(<M3TextField label="Test Label" errorText="Error message" />);
      const errorText = screen.getByText('Error message');
      
      expect(errorText).toHaveClass('text-[var(--md-sys-color-error)]');
    });

    it('applies error color to label when in error state', () => {
      render(<M3TextField label="Test Label" error />);
      const label = screen.getByText('Test Label');
      
      expect(label).toHaveClass('text-[var(--md-sys-color-error)]');
    });

    it('applies error border color to filled variant', () => {
      render(<M3TextField label="Test Label" variant="filled" error />);
      const container = screen.getByRole('textbox').closest('div')?.parentElement;
      
      expect(container).toHaveClass('border-b-[var(--md-sys-color-error)]');
    });

    it('applies error border color to outlined variant', () => {
      render(<M3TextField label="Test Label" variant="outlined" error />);
      const container = screen.getByRole('textbox').closest('div')?.parentElement;
      
      expect(container).toHaveClass('border-[var(--md-sys-color-error)]');
    });

    it('sets aria-invalid when in error state', () => {
      render(<M3TextField label="Test Label" error />);
      const input = screen.getByRole('textbox');
      
      expect(input).toHaveAttribute('aria-invalid', 'true');
    });

    it('error text replaces supporting text when both provided', () => {
      render(
        <M3TextField 
          label="Test Label" 
          supportingText="Helper text" 
          errorText="Error message" 
        />
      );
      
      expect(screen.getByText('Error message')).toBeInTheDocument();
      expect(screen.queryByText('Helper text')).not.toBeInTheDocument();
    });
  });

  describe('Supporting Text', () => {
    it('displays supporting text when provided', () => {
      render(<M3TextField label="Test Label" supportingText="Helper text" />);
      
      expect(screen.getByText('Helper text')).toBeInTheDocument();
    });

    it('applies correct color to supporting text', () => {
      render(<M3TextField label="Test Label" supportingText="Helper text" />);
      const supportingText = screen.getByText('Helper text');
      
      expect(supportingText).toHaveClass('text-[var(--md-sys-color-on-surface-variant)]');
    });

    it('links supporting text to input via aria-describedby', () => {
      render(<M3TextField label="Test Label" supportingText="Helper text" />);
      const input = screen.getByRole('textbox');
      const supportingText = screen.getByText('Helper text');
      
      expect(input).toHaveAttribute('aria-describedby', supportingText.id);
    });
  });

  describe('Icon Rendering', () => {
    const LeadingIcon = () => <span data-testid="leading-icon">📧</span>;
    const TrailingIcon = () => <span data-testid="trailing-icon">✓</span>;

    it('renders leading icon when provided', () => {
      render(<M3TextField label="Test Label" leadingIcon={<LeadingIcon />} />);
      
      expect(screen.getByTestId('leading-icon')).toBeInTheDocument();
    });

    it('renders trailing icon when provided', () => {
      render(<M3TextField label="Test Label" trailingIcon={<TrailingIcon />} />);
      
      expect(screen.getByTestId('trailing-icon')).toBeInTheDocument();
    });

    it('renders both icons when provided', () => {
      render(
        <M3TextField 
          label="Test Label" 
          leadingIcon={<LeadingIcon />} 
          trailingIcon={<TrailingIcon />} 
        />
      );
      
      expect(screen.getByTestId('leading-icon')).toBeInTheDocument();
      expect(screen.getByTestId('trailing-icon')).toBeInTheDocument();
    });

    it('applies error color to trailing icon when in error state', () => {
      render(
        <M3TextField 
          label="Test Label" 
          trailingIcon={<TrailingIcon />} 
          error 
        />
      );
      const trailingIconContainer = screen.getByTestId('trailing-icon').parentElement;
      
      expect(trailingIconContainer).toHaveClass('text-[var(--md-sys-color-error)]');
    });

    it('applies default color to trailing icon when not in error state', () => {
      render(
        <M3TextField 
          label="Test Label" 
          trailingIcon={<TrailingIcon />} 
        />
      );
      const trailingIconContainer = screen.getByTestId('trailing-icon').parentElement;
      
      expect(trailingIconContainer).toHaveClass('text-[var(--md-sys-color-on-surface-variant)]');
    });
  });


  describe('Disabled State', () => {
    it('renders disabled input with correct attributes', () => {
      render(<M3TextField label="Test Label" disabled />);
      const input = screen.getByRole('textbox');
      
      expect(input).toBeDisabled();
    });

    it('applies disabled opacity to container', () => {
      const { container } = render(<M3TextField label="Test Label" disabled />);
      const wrapper = container.firstChild;
      
      expect(wrapper).toHaveClass('opacity-38');
      expect(wrapper).toHaveClass('pointer-events-none');
    });
  });

  describe('Value and onChange', () => {
    it('displays initial value', () => {
      render(<M3TextField label="Test Label" value="Initial value" />);
      const input = screen.getByRole('textbox');
      
      expect(input).toHaveValue('Initial value');
    });

    it('calls onChange when value changes', () => {
      const handleChange = vi.fn();
      render(<M3TextField label="Test Label" onChange={handleChange} />);
      const input = screen.getByRole('textbox');
      
      fireEvent.change(input, { target: { value: 'New value' } });
      
      expect(handleChange).toHaveBeenCalledWith('New value');
    });

    it('updates internal value when typing', () => {
      render(<M3TextField label="Test Label" />);
      const input = screen.getByRole('textbox');
      
      fireEvent.change(input, { target: { value: 'Typed text' } });
      
      expect(input).toHaveValue('Typed text');
    });
  });

  describe('Focus and Blur Events', () => {
    it('calls onFocus when input is focused', () => {
      const handleFocus = vi.fn();
      render(<M3TextField label="Test Label" onFocus={handleFocus} />);
      const input = screen.getByRole('textbox');
      
      fireEvent.focus(input);
      
      expect(handleFocus).toHaveBeenCalled();
    });

    it('calls onBlur when input loses focus', () => {
      const handleBlur = vi.fn();
      render(<M3TextField label="Test Label" onBlur={handleBlur} />);
      const input = screen.getByRole('textbox');
      
      fireEvent.focus(input);
      fireEvent.blur(input);
      
      expect(handleBlur).toHaveBeenCalled();
    });
  });

  describe('Accessibility', () => {
    it('associates label with input via htmlFor', () => {
      render(<M3TextField label="Email Address" />);
      const input = screen.getByRole('textbox');
      const label = screen.getByText('Email Address');
      
      expect(label).toHaveAttribute('for', input.id);
    });

    it('uses provided id for input', () => {
      render(<M3TextField label="Test Label" id="custom-id" />);
      const input = screen.getByRole('textbox');
      
      expect(input).toHaveAttribute('id', 'custom-id');
    });
  });

  describe('Custom className', () => {
    it('applies custom className to container', () => {
      const { container } = render(<M3TextField label="Test Label" className="custom-class" />);
      const wrapper = container.firstChild;
      
      expect(wrapper).toHaveClass('custom-class');
    });
  });
});
