# Test Regression Fixes

## 1. Verify Schema
- `users` table should have `must_change_password` column (boolean, default false).

## 2. Verify Auth Logic (Manual)
### Scenario 1: New Collaborator (Force Change)
1. Log in as 'admin'.
2. Invite a new collaborator.
3. Check `users` table: `must_change_password` should be FALSE by default (fix needed in API route to set TRUE?).
   - **Correction**: API route `POST /api/school/collaborators` handles creation. Need to update it to set `must_change_password = TRUE`.
4. Log in as new collaborator.
5. Verify redirect to `/auth/update-password`.

### Scenario 2: Existing User (No Change)
1. Log in as existing user (e.g., `Pledgeum@gmail.com`).
2. Verify access to dashboard (no redirect).
