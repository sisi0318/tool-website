import '@testing-library/jest-dom/vitest';

// Mock ResizeObserver for Radix UI components
global.ResizeObserver = class ResizeObserver {
  observe() {}
  unobserve() {}
  disconnect() {}
};

// Mock PointerEvent for Radix UI slider
class MockPointerEvent extends Event {
  button: number;
  ctrlKey: boolean;
  pointerType: string;
  clientX: number;
  clientY: number;

  constructor(type: string, props: PointerEventInit = {}) {
    super(type, props);
    this.button = props.button ?? 0;
    this.ctrlKey = props.ctrlKey ?? false;
    this.pointerType = props.pointerType ?? 'mouse';
    this.clientX = props.clientX ?? 0;
    this.clientY = props.clientY ?? 0;
  }
}

global.PointerEvent = MockPointerEvent as unknown as typeof PointerEvent;
