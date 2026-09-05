/**
 * M3 Accessibility Tests
 *
 * 覆盖仍在使用的 M3 组件的可访问性约定：焦点指示、ARIA 角色与键盘操作。
 * （button / input / switch / navigation / dialog / search 等模块已随死代码清理删除，
 *  相关用例一并移除；表单与对话框现由 components/ui/ 的 shadcn 实现承担。）
 */

import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import * as React from 'react';

import { M3Card } from './card';
import { M3Chip } from './chip';
import { M3Slider } from './slider';
import { M3Tabs, type TabItem } from './tabs';

const mockTabItems: TabItem[] = [
  { id: 'tab1', label: 'Tab 1' },
  { id: 'tab2', label: 'Tab 2' },
  { id: 'tab3', label: 'Tab 3' },
];

describe('M3 Accessibility - Focus Indicators', () => {
  it('M3Card interactive should be focusable', () => {
    render(
      <M3Card interactive onClick={() => undefined}>
        Card content
      </M3Card>
    );

    const card = screen.getByRole('button');
    expect(card).toHaveAttribute('tabIndex', '0');
  });

  it('M3Chip should have focus-visible styles', () => {
    render(<M3Chip>Chip</M3Chip>);

    const chip = screen.getByRole('button');
    expect(chip.className).toContain('focus-visible:');
  });
});

describe('M3 Accessibility - ARIA Labels and Roles', () => {
  it('M3Card interactive should have role="button"', () => {
    render(
      <M3Card interactive onClick={() => undefined}>
        Interactive card
      </M3Card>
    );

    expect(screen.getByRole('button')).toBeInTheDocument();
  });

  it('M3Chip filter should have aria-pressed', () => {
    render(
      <M3Chip variant="filter" selected>
        Filter chip
      </M3Chip>
    );

    expect(screen.getByRole('button')).toHaveAttribute('aria-pressed', 'true');
  });

  it('M3Tabs should have role="tablist"', () => {
    render(<M3Tabs tabs={mockTabItems} activeTab="tab1" onTabChange={() => undefined} />);

    expect(screen.getByRole('tablist')).toBeInTheDocument();
  });

  it('M3Tab should have role="tab" and aria-selected', () => {
    render(<M3Tabs tabs={mockTabItems} activeTab="tab1" onTabChange={() => undefined} />);

    const tabs = screen.getAllByRole('tab');
    expect(tabs[0]).toHaveAttribute('aria-selected', 'true');
    expect(tabs[1]).toHaveAttribute('aria-selected', 'false');
  });

  it('M3Slider should have proper ARIA attributes', () => {
    render(<M3Slider value={[50]} min={0} max={100} aria-label="Volume" />);

    const slider = screen.getByRole('slider');
    expect(slider).toHaveAttribute('aria-valuenow', '50');
    expect(slider).toHaveAttribute('aria-valuemin', '0');
    expect(slider).toHaveAttribute('aria-valuemax', '100');
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

  it('M3Tabs 只有当前标签在 Tab 序列里,方向键在标签间移动焦点并切换', () => {
    const onTabChange = vi.fn();
    render(<M3Tabs tabs={mockTabItems} activeTab="tab1" onTabChange={onTabChange} />);

    const tabs = screen.getAllByRole('tab');
    expect(tabs[0]).toHaveAttribute('tabindex', '0');
    expect(tabs[1]).toHaveAttribute('tabindex', '-1');

    tabs[0].focus();
    fireEvent.keyDown(tabs[0], { key: 'ArrowRight' });
    expect(onTabChange).toHaveBeenLastCalledWith('tab2');
    expect(tabs[1]).toHaveFocus();

    fireEvent.keyDown(tabs[1], { key: 'End' });
    expect(onTabChange).toHaveBeenLastCalledWith('tab3');
    expect(tabs[2]).toHaveFocus();

    // 受控属性没更新,当前标签仍是 tab1:向左从头绕到尾
    fireEvent.keyDown(tabs[2], { key: 'ArrowLeft' });
    expect(onTabChange).toHaveBeenLastCalledWith('tab3');
  });

  it('M3Tabs Delete 键关闭可关闭的当前标签,关闭按钮不再占用 Tab 序列', async () => {
    const onTabClose = vi.fn();
    render(
      <M3Tabs
        tabs={mockTabItems.map((tab) => ({ ...tab, closable: true }))}
        activeTab="tab2"
        onTabChange={() => undefined}
        onTabClose={onTabClose}
      />
    );

    for (const close of screen.getAllByRole('button', { name: 'Close tab' })) {
      expect(close).toHaveAttribute('tabindex', '-1');
    }

    fireEvent.keyDown(screen.getAllByRole('tab')[1], { key: 'Delete' });
    await waitFor(() => expect(onTabClose).toHaveBeenCalledWith('tab2'));
  });

  it('M3Chip should activate with click', () => {
    const handleClick = vi.fn();

    render(<M3Chip onClick={handleClick}>Clickable chip</M3Chip>);

    fireEvent.click(screen.getByRole('button'));

    expect(handleClick).toHaveBeenCalled();
  });
});
