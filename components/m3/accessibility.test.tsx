/**
 * M3 Accessibility Tests
 *
 * 覆盖仍在使用的 M3 组件的可访问性约定:ARIA 角色与键盘操作。
 * card / chip / slider / progress 已换成 components/ui 的实现并删除,
 * 这里只剩工具工作台在用的 Tabs(BottomSheet 的用例在它自己的测试文件里)。
 */

import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import * as React from 'react';

import { M3Tabs, type TabItem } from './tabs';

const mockTabItems: TabItem[] = [
  { id: 'tab1', label: 'Tab 1' },
  { id: 'tab2', label: 'Tab 2' },
  { id: 'tab3', label: 'Tab 3' },
];

describe('M3 Accessibility - ARIA Labels and Roles', () => {
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
});

describe('M3 Accessibility - Keyboard Navigation', () => {
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
});
