# Implementation Plan

## Phase 1: Design Token Foundation

- [ ] 1. Set up M3 design token infrastructure









  - [x] 1.1 Create color token system with seed color generator


    - Create `lib/m3/tokens/color.ts` with M3ColorScheme interface
    - Implement `generateColorScheme(seedColor: string)` function
    - Include all color roles: primary, secondary, tertiary, error, surface variants
    - _Requirements: 1.1, 1.2, 1.3_
  - [x] 1.2 Write property test for color scheme generation




    - **Property 1: Color Scheme Generation Completeness**
    - **Validates: Requirements 1.1, 1.2, 1.3**
  - [x] 1.3 Create state layer utility functions





    - Implement `applyStateLayer(baseColor, state, opacity)` function
    - Define state opacity constants: hover=0.08, focus=0.12, pressed=0.12, dragged=0.16
    - _Requirements: 1.4_
  - [x] 1.4 Write property test for state layer opacity





    - **Property 2: State Layer Opacity Consistency**
    - **Validates: Requirements 1.4**

- [x] 2. Create typography token system



  - [x] 2.1 Define M3 typography scale


    - Create `lib/m3/tokens/typography.ts` with M3TypeScale interface
    - Define all 15 typography styles from display-large to label-small
    - Configure Google Sans / Roboto font family

    - _Requirements: 2.1, 2.2_
  - [x] 2.2 Write property test for typography scale completeness

    - **Property 3: Typography Scale Completeness**
    - **Validates: Requirements 2.1**
  - [x] 2.3 Create contrast ratio utility


    - Implement `calculateContrastRatio(foreground, background)` function
    - Implement `meetsWCAGAA(ratio, isLargeText)` function
    - _Requirements: 2.3_
  - [x] 2.4 Write property test for contrast ratio compliance



    - **Property 4: Color Contrast Compliance**
    - **Validates: Requirements 2.3, 11.2**


- [x] 3. Create shape and motion token systems





  - [x] 3.1 Define M3 Expressive shape tokens

    - Create `lib/m3/tokens/shape.ts` with M3ExpressiveShape interface
    - Define corner radius values: extraSmall=4px, small=8px, medium=16px, large=24px, extraLarge=28px, full=9999px
    - _Requirements: 3.1, 3.2, 3.3_

  - [x] 3.2 Write property test for shape token validity

    - **Property 5: Shape Token Validity**
    - **Validates: Requirements 3.1, 3.2, 3.3**

  - [x] 3.3 Define M3 motion tokens

    - Create `lib/m3/tokens/motion.ts` with M3Motion interface
    - Define duration values from short1 (50ms) to long2 (500ms)
    - Define easing curves: standard, emphasized, decelerate, accelerate variants
    - _Requirements: 5.1, 5.2_

  - [x] 3.4 Write property test for motion token validity

    - **Property 6: Motion Token Validity**
    - **Validates: Requirements 5.1, 5.2**

- [x] 4. Checkpoint - Ensure all tests pass





  - Ensure all tests pass, ask the user if questions arise.

## Phase 2: CSS Foundation and Theme Provider

- [x] 5. Update global CSS with M3 custom properties





  - [x] 5.1 Replace existing CSS variables with M3 tokens


    - Update `app/globals.css` with all M3 color custom properties
    - Add light and dark theme color definitions
    - Add shape, motion, and typography custom properties
    - _Requirements: 1.1, 1.2, 11.1_

  - [x] 5.2 Create dark mode color scheme

    - Define dark mode surface colors using tonal elevation

    - Ensure proper contrast ratios in dark mode
    - _Requirements: 11.1, 11.2_
  - [x] 5.3 Write property test for dark mode color validity

    - **Property 9: Dark Mode Color Scheme Validity**
    - **Validates: Requirements 11.1**


- [x] 6. Update Tailwind configuration





  - [x] 6.1 Extend Tailwind with M3 design tokens

    - Update `tailwind.config.ts` with M3 color mappings
    - Add M3 border-radius utilities
    - Add M3 transition duration and timing utilities
    - _Requirements: 1.1, 3.1, 5.1_

- [x] 7. Create M3 Theme Provider





  - [x] 7.1 Implement theme context and provider


    - Create `lib/m3/theme/context.ts` with theme context
    - Create `lib/m3/theme/provider.tsx` with M3ThemeProvider component
    - Support light/dark/system theme modes
    - _Requirements: 1.2, 11.3_


  - [ ] 7.2 Update root layout with M3 Theme Provider
    - Update `app/layout.tsx` to use M3ThemeProvider
    - Configure font loading for Google Sans / Roboto
    - _Requirements: 2.2_

- [x] 8. Checkpoint - Ensure all tests pass





  - Ensure all tests pass, ask the user if questions arise.

## Phase 3: Core M3 Components

- [x] 9. Create M3 Button component






  - [x] 9.1 Implement Button with all variants

    - Create `components/m3/button/button.tsx`
    - Implement filled, outlined, text, elevated, tonal variants
    - Add ripple effect on interaction
    - Apply M3 Expressive shape (medium corners for standard, full for FAB)
    - _Requirements: 4.1, 3.3, 5.4_

  - [x] 9.2 Write unit tests for Button component

    - Test all variant renderings
    - Test disabled and loading states
    - Test ripple effect trigger

- [x] 10. Create M3 Card component






  - [x] 10.1 Implement Card with all variants

    - Create `components/m3/card/card.tsx`
    - Implement elevated, filled, outlined variants
    - Apply M3 Expressive shape (large/extra-large corners)
    - Add hover and pressed state layers
    - _Requirements: 4.2, 3.2, 8.1, 8.2, 8.3_


  - [ ] 10.2 Write unit tests for Card component
    - Test all variant renderings
    - Test interactive state changes


- [x] 11. Create M3 Input components





  - [x] 11.1 Implement TextField with filled and outlined variants

    - Create `components/m3/input/text-field.tsx`
    - Implement label animation on focus
    - Add supporting text and error text display
    - Add leading and trailing icon support
    - _Requirements: 4.3_


  - [ ] 11.2 Write unit tests for TextField component
    - Test label animation states
    - Test error state display
    - Test icon rendering



- [x] 12. Create M3 Navigation components



  - [x] 12.1 Implement Navigation Bar for mobile


    - Create `components/m3/navigation/navigation-bar.tsx`
    - Support up to 5 navigation items
    - Implement indicator animation on selection
    - Apply 80dp height with proper safe area handling
    - _Requirements: 4.4, 14.1, 14.2, 13.3_

  - [x] 12.2 Implement Navigation Rail for desktop

    - Create `components/m3/navigation/navigation-rail.tsx`
    - Support FAB placement
    - Implement indicator animation
    - _Requirements: 4.4, 6.2, 6.3_

  - [x] 12.3 Write unit tests for Navigation components

    - Test item selection and indicator



    - Test responsive switching




- [x] 13. Create M3 Tabs component







  - [ ] 13.1 Implement Tabs with primary and secondary variants
    - Create `components/m3/tabs/tabs.tsx` and `tab.tsx`






    - Implement indicator animation using M3 emphasized motion
    - Support tab add/close animations
    - _Requirements: 4.5, 9.1, 9.2, 9.3, 9.4_




































  - [ ] 13.2 Write unit tests for Tabs component
    - Test tab selection and indicator animation
    - Test tab add/remove behavior

- [x] 14. Checkpoint - Ensure all tests pass





  - Ensure all tests pass, ask the user if questions arise.




## Phase 4: Additional M3 Components



- [x] 15. Create M3 Dialog component





  - [x] 15.1 Implement Dialog with M3 styling


    - Create `components/m3/dialog/dialog.tsx`
    - Apply proper scrim (32% opacity)
    - Use surface-container-high background
    - Position action buttons correctly
    - _Requirements: 4.6_

  - [x] 15.2 Write unit tests for Dialog component



- [x] 16. Create M3 Chip component






  - [x] 16.1 Implement Chip with all variants


    - Create `components/m3/chip/chip.tsx`
    - Implement assist, filter, input, suggestion variants
    - _Requirements: 4.7_
  - [x] 16.2 Write unit tests for Chip component


- [x] 17. Create M3 Switch component

  - [x] 17.1 Implement Switch with M3 styling
    - Create `components/m3/switch/switch.tsx`
    - Implement track, thumb, and icon states
    - _Requirements: 4.8_
  - [x] 17.2 Write unit tests for Switch component


- [x] 18. Create M3 Slider component







  - [x] 18.1 Implement Slider with M3 styling

    - Create `components/m3/slider/slider.tsx`
    - Implement track, thumb, and value indicator
    - _Requirements: 4.9_
  - [x] 18.2 Write unit tests for Slider component



- [x] 19. Create M3 Progress indicators





  - [x] 19.1 Implement linear and circular progress


    - Create `components/m3/progress/linear-progress.tsx`
    - Create `components/m3/progress/circular-progress.tsx`
    - _Requirements: 4.10_

  - [x] 19.2 Write unit tests for Progress components

- [x] 20. Create M3 Search Bar component







  - [x] 20.1 Implement Search Bar with M3 styling

    - Create `components/m3/search/search-bar.tsx`
    - Apply large corner radius
    - Implement expand animation on focus
    - _Requirements: 10.1, 10.3_

  - [x] 20.2 Write unit tests for Search Bar component


- [x] 21. Checkpoint - Ensure all tests pass





  - Ensure all tests pass, ask the user if questions arise.

## Phase 5: Responsive Layout System


- [x] 22. Implement responsive layout utilities





  - [x] 22.1 Create breakpoint detection hook


    - Create `hooks/use-breakpoint.ts`
    - Detect compact (<600px), medium (600-840px), expanded (>840px)
    - _Requirements: 6.1, 6.2, 6.3_


  - [x] 22.2 Write property test for breakpoint consistency
    - **Property 7: Responsive Layout Breakpoint Consistency**
    - **Validates: Requirements 6.1, 6.2, 6.3**
  - [x] 22.3 Create responsive layout wrapper


    - Create `components/m3/layout/responsive-layout.tsx`
    - Handle navigation switching between Bar and Rail
    - Animate layout transitions
    - _Requirements: 6.4_

- [x] 23. Implement mobile-specific layouts





  - [x] 23.1 Create mobile tool page layout

    - Implement vertical stacking for input/output sections
    - Add full-width button styling
    - Handle keyboard visibility
    - _Requirements: 15.1, 15.2, 15.3, 13.5_

  - [x] 23.2 Write property test for mobile vertical stacking

    - **Property 10: Mobile Layout Vertical Stacking**
    - **Validates: Requirements 15.1, 15.2**

- [x] 24. Checkpoint - Ensure all tests pass





  - Ensure all tests pass, ask the user if questions arise.

## Phase 6: Application Page Updates


- [x] 25. Update Header component





  - [x] 25.1 Redesign Header with M3 Top App Bar

    - Update `components/header.tsx` with M3 styling
    - Implement scroll behavior with elevation change
    - Update theme toggle with animated icon transition
    - Apply minimum 48dp touch targets
    - _Requirements: 7.1, 7.2, 7.3, 7.4, 12.1_
  - [x] 25.2 Write property test for touch target size


    - **Property 8: Touch Target Minimum Size**
    - **Validates: Requirements 12.1, 13.3**

- [x] 26. Update Tool Grid component






  - [x] 26.1 Redesign tool cards with M3 Expressive styling

    - Update `components/tool-grid.tsx` with M3 Card component
    - Apply hover and pressed state layers
    - Update icon containers with tonal surface colors
    - _Requirements: 8.1, 8.2, 8.3, 8.4_
  - [x] 26.2 Implement responsive grid layout


    - Single column for compact, two columns for medium, multi-column for expanded
    - _Requirements: 6.1, 6.2, 6.3, 13.4_


- [x] 27. Update Tools page




  - [x] 27.1 Redesign tab system with M3 Tabs


    - Update `app/tools/page.tsx` tab rendering
    - Implement tab indicator animation
    - Add tab add/close animations
    - _Requirements: 9.1, 9.2, 9.3, 9.4_
  - [x] 27.2 Redesign search functionality


    - Update search bar with M3 Search Bar component
    - Update search results with M3 menu styling
    - _Requirements: 10.1, 10.2, 10.3, 10.4_

  - [x] 27.3 Implement mobile-optimized tools page

    - Add bottom sheet for tool options
    - Implement swipe gestures for tab switching
    - _Requirements: 15.5, 17.1_

- [x] 28. Checkpoint - Ensure all tests pass





  - Ensure all tests pass, ask the user if questions arise.

## Phase 7: Accessibility and Polish

- [x] 29. Implement accessibility features





  - [x] 29.1 Add focus indicators to all interactive elements


    - Implement M3 focus ring specifications
    - _Requirements: 12.2_
  - [x] 29.2 Add ARIA labels and roles


    - Audit all components for proper ARIA attributes
    - _Requirements: 12.3_

  - [x] 29.3 Implement reduced motion support

    - Respect prefers-reduced-motion media query
    - Provide fallback static states
    - _Requirements: 12.4_

  - [x] 29.4 Write accessibility tests

    - Test focus indicator visibility
    - Test ARIA label presence
    - Test reduced motion behavior

- [x] 30. Implement mobile gestures





  - [x] 30.1 Add swipe gesture support


    - Implement horizontal swipe for tab switching
    - Implement pull-to-refresh
    - _Requirements: 17.1, 17.2_

  - [x] 30.2 Add long-press context menu

    - Implement long-press detection on tool cards
    - Display M3 styled context menu
    - _Requirements: 17.3_

- [x] 31. Performance optimization





  - [x] 31.1 Optimize animations for 60fps


    - Use CSS transforms and opacity for animations
    - Avoid layout-triggering properties in animations
    - _Requirements: 16.2_
  - [x] 31.2 Implement lazy loading


    - Lazy load non-critical images and icons
    - _Requirements: 16.3_




- [x] 32. Final Checkpoint - Ensure all tests pass


  - Ensure all tests pass, ask the user if questions arise.
