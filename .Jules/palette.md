## 2026-10-24 - Interactive Buttons in Custom Timelines
**Learning:** Icon-only controls and expandable group/venue headers in custom canvas/DOM timelines require explicit `aria-label` and `aria-expanded` attributes so screen readers accurately announce expand/collapse state changes and control actions.
**Action:** Always provide dynamic `aria-label` and `aria-expanded` states when building expand/collapse tree rows in schedule or matrix views.
