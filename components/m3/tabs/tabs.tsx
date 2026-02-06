'use client';

import * as React from 'react';
import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from '@/lib/utils';
import { M3Tab } from './tab';

/**
 * M3 Tabs Component
 * 
 * Implements Material You 3 Expressive tabs specifications with:
 * - Primary and secondary variants
 * - Indicator animation using M3 emphasized motion
 * - Tab add/close animations
 * - Scrollable tabs support
 * 
 * Requirements: 4.5, 9.1, 9.2, 9.3, 9.4
 */

export interface TabItem {
  /** Unique identifier for the tab */
  id: string;
  /** Tab label */
  label: string;
  /** Icon to display in the tab */
  icon?: React.ReactNode;
  /** Whether the tab can be closed */
  closable?: boolean;
  /** Whether the tab is disabled */
  disabled?: boolean;
}

export interface M3TabsProps extends React.HTMLAttributes<HTMLDivElement> {
  /** Tab items */
  tabs: TabItem[];
  /** Currently active tab ID */
  activeTab: string;
  /** Callback when a tab is selected */
  onTabChange: (id: string) => void;
  /** Callback when a tab is closed */
  onTabClose?: (id: string) => void;
  /** Tab variant */
  variant?: 'primary' | 'secondary';
  /** Whether tabs should be scrollable */
  scrollable?: boolean;
  /** Accessible label for the tab list */
  'aria-label'?: string;
  /** ID of element that labels this tab list */
  'aria-labelledby'?: string;
}

/**
 * Tabs container styles
 */
const tabsContainerVariants = cva(
  [
    'relative',
    'flex items-end',
    'bg-[var(--md-sys-color-surface)]',
    'border-b border-[var(--md-sys-color-surface-variant)]',
  ].join(' '),
  {
    variants: {
      scrollable: {
        true: 'overflow-x-auto scrollbar-hide',
        false: '',
      },
    },
    defaultVariants: {
      scrollable: false,
    },
  }
);

/**
 * Tab list styles
 */
const tabListVariants = cva(
  [
    'relative',
    'flex items-end',
    'min-w-full',
    'flex-none', // Ensure container doesn't shrink and allows scrolling
  ].join(' ')
);

/**
 * Indicator styles for primary variant (bottom line)
 */
const primaryIndicatorVariants = cva(
  [
    'absolute bottom-0',
    'h-[3px]',
    'bg-[var(--md-sys-color-primary)]',
    'rounded-t-full',
    'transition-all',
    'duration-[var(--md-sys-motion-duration-medium2)]',
    'ease-[var(--md-sys-motion-easing-emphasized)]',
  ].join(' ')
);

/**
 * Indicator styles for secondary variant (full background)
 */
const secondaryIndicatorVariants = cva(
  [
    'absolute bottom-0',
    'h-full',
    'bg-[var(--md-sys-color-secondary-container)]',
    'transition-all',
    'duration-[var(--md-sys-motion-duration-medium2)]',
    'ease-[var(--md-sys-motion-easing-emphasized)]',
  ].join(' ')
);

/**
 * Hook to track indicator position and size
 */
function useIndicator(
  activeTab: string,
  tabRefs: React.MutableRefObject<Map<string, HTMLButtonElement | null>>,
  containerRef: React.RefObject<HTMLDivElement | null>,
  tabCount: number, // 添加 tabCount 参数来触发重新计算
  isAnimating: boolean // 是否有动画正在进行
) {
  const [indicatorStyle, setIndicatorStyle] = React.useState<{
    left: number;
    width: number;
  }>({ left: 0, width: 0 });

  const updateIndicator = React.useCallback(() => {
    const activeTabElement = tabRefs.current.get(activeTab);
    const container = containerRef.current;

    if (activeTabElement && container) {
      const containerRect = container.getBoundingClientRect();
      const tabRect = activeTabElement.getBoundingClientRect();

      setIndicatorStyle({
        left: tabRect.left - containerRect.left + container.scrollLeft,
        width: tabRect.width,
      });
    }
  }, [activeTab, tabRefs, containerRef]);

  React.useEffect(() => {
    // 如果有动画正在进行，延迟更新指示器位置
    const delay = isAnimating ? 50 : 0;

    const timeoutId = setTimeout(() => {
      // 使用 requestAnimationFrame 确保 DOM 已更新
      requestAnimationFrame(() => {
        updateIndicator();
      });
    }, delay);

    // Update on resize
    const handleResize = () => updateIndicator();
    window.addEventListener('resize', handleResize);

    return () => {
      clearTimeout(timeoutId);
      window.removeEventListener('resize', handleResize);
    };
  }, [updateIndicator, tabCount, isAnimating]);

  return { indicatorStyle, updateIndicator };
}

/**
 * M3 Tabs Component
 * 
 * A Material You 3 Expressive tabs component with:
 * - Primary and secondary variants
 * - Animated indicator on selection
 * - Tab add/close animations
 * - Scrollable tabs support
 */
const M3Tabs = React.forwardRef<HTMLDivElement, M3TabsProps>(
  (
    {
      className,
      tabs,
      activeTab,
      onTabChange,
      onTabClose,
      variant = 'primary',
      scrollable = false,
      'aria-label': ariaLabel,
      'aria-labelledby': ariaLabelledBy,
      ...props
    },
    ref
  ) => {
    const containerRef = React.useRef<HTMLDivElement>(null);
    const scrollContainerRef = React.useRef<HTMLDivElement>(null);
    const tabRefs = React.useRef<Map<string, HTMLButtonElement | null>>(new Map());
    const [animatingTabs, setAnimatingTabs] = React.useState<Set<string>>(new Set());
    const [exitingTabs, setExitingTabs] = React.useState<Set<string>>(new Set());
    const prevTabsRef = React.useRef<TabItem[]>(tabs);

    const isAnimating = animatingTabs.size > 0 || exitingTabs.size > 0;
    const { indicatorStyle, updateIndicator } = useIndicator(
      activeTab,
      tabRefs,
      containerRef,
      tabs.length,
      isAnimating
    );

    // 鼠标滚轮转横向滚动
    React.useEffect(() => {
      const el = scrollContainerRef.current;
      if (!el || !scrollable) return;

      const handleWheel = (e: WheelEvent) => {
        if (Math.abs(e.deltaY) > Math.abs(e.deltaX)) {
          e.preventDefault();
          el.scrollLeft += e.deltaY;
        }
      };

      el.addEventListener('wheel', handleWheel, { passive: false });
      return () => el.removeEventListener('wheel', handleWheel);
    }, [scrollable]);

    // 自动滚动到激活的 tab
    React.useEffect(() => {
      if (!scrollable || !scrollContainerRef.current) return;
      const activeTabEl = tabRefs.current.get(activeTab);
      if (activeTabEl) {
        activeTabEl.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'nearest' });
      }
    }, [activeTab, scrollable]);

    // Detect new tabs for enter animation
    React.useEffect(() => {
      const prevIds = new Set(prevTabsRef.current.map(t => t.id));
      const newTabs = tabs.filter(t => !prevIds.has(t.id));

      if (newTabs.length > 0) {
        const newIds = new Set(newTabs.map(t => t.id));
        setAnimatingTabs(newIds);

        // Remove animation class after animation completes and update indicator
        const timer = setTimeout(() => {
          setAnimatingTabs(new Set());
          // 动画完成后更新指示器位置
          requestAnimationFrame(() => {
            updateIndicator();
          });
        }, 500); // M3 emphasized motion duration

        return () => clearTimeout(timer);
      }

      prevTabsRef.current = tabs;
    }, [tabs, updateIndicator]);

    const handleTabClose = (id: string) => {
      // Add to exiting tabs for exit animation
      setExitingTabs(prev => new Set(prev).add(id));

      // Call onTabClose after animation
      setTimeout(() => {
        setExitingTabs(prev => {
          const next = new Set(prev);
          next.delete(id);
          return next;
        });
        onTabClose?.(id);
        // 动画完成后更新指示器位置
        requestAnimationFrame(() => {
          updateIndicator();
        });
      }, 200); // M3 standard motion duration for exit
    };

    const setTabRef = (id: string) => (el: HTMLButtonElement | null) => {
      tabRefs.current.set(id, el);
    };

    // Filter out exiting tabs from display
    const visibleTabs = tabs.filter(tab => !exitingTabs.has(tab.id) || exitingTabs.has(tab.id));

    return (
      <div
        ref={scrollContainerRef}
        className={cn(tabsContainerVariants({ scrollable }), className)}
        role="tablist"
        aria-orientation="horizontal"
        aria-label={ariaLabel}
        aria-labelledby={ariaLabelledBy}
        {...props}
      >
        <div ref={containerRef} className={cn(tabListVariants())}>
          {/* Indicator */}
          {variant === 'primary' ? (
            <span
              className={cn(primaryIndicatorVariants())}
              style={{
                left: indicatorStyle.left,
                width: indicatorStyle.width,
              }}
              aria-hidden="true"
            />
          ) : (
            <span
              className={cn(secondaryIndicatorVariants())}
              style={{
                left: indicatorStyle.left,
                width: indicatorStyle.width,
              }}
              aria-hidden="true"
            />
          )}

          {/* Tabs */}
          {visibleTabs.map((tab) => {
            const isEntering = animatingTabs.has(tab.id);
            const isExiting = exitingTabs.has(tab.id);

            return (
              <M3Tab
                key={tab.id}
                ref={setTabRef(tab.id)}
                variant={variant}
                isActive={activeTab === tab.id}
                icon={tab.icon}
                closable={tab.closable}
                disabled={tab.disabled}
                onClick={() => onTabChange(tab.id)}
                onClose={() => handleTabClose(tab.id)}
                className={cn(
                  // Enter animation - 只使用淡入，不使用位移动画以避免指示器位置问题
                  isEntering && [
                    'animate-in fade-in-0',
                    'duration-300',
                  ].join(' '),
                  // Exit animation - 只使用淡出
                  isExiting && [
                    'animate-out fade-out-0',
                    'duration-200',
                  ].join(' ')
                )}
              >
                {tab.label}
              </M3Tab>
            );
          })}
        </div>
      </div>
    );
  }
);

M3Tabs.displayName = 'M3Tabs';

export { M3Tabs, tabsContainerVariants, tabListVariants };
