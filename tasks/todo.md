# To-Do: Fix Schedule Generation (SqliteError: ON CONFLICT)

- [x] Execute `server/fix_constraints.js` to rebuild database tables (`daily_habits`, `daily_stats`, `daily_overrides`) with new updated `UNIQUE(userId, ...)` constraints.
- [/] Restart the backend server (`node server/index.js`).
- [ ] Test the "Generate Schedule" feature to verify the fix works and schedule saves correctly.
- [ ] Document results in this file.
- [ ] Update `tasks/lessons.md` with lessons learned from this DB constraint issue.
