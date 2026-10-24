## 2026-10-24 - Unconditional string aggregation in session filter matching
**Learning:** `matches()` in `src/lib/project.ts` previously gathered session, venue, role, group, and assigned person names into a single string array and normalized it even when no search query (`f.query`) was present. In addition, session assignments `aa` were filtered unconditionally before testing venue or status filters.
**Action:** Always check if a query or assignment filter is active before fetching assignments or assembling search strings and running string normalization.
