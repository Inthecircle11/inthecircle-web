# Branch protection for main

Configure GitHub so that `main` cannot be force-pushed or deleted, and all changes land via pull requests with passing checks.

## Steps (one-time)

1. Open the repo on GitHub: **https://github.com/Inthecircle11/inthecircle-web** (or your org/repo).
2. Go to **Settings** → **Branches**.
3. Under **Branch protection rules**, click **Add rule** (or **Add branch protection rule**).
4. Set **Branch name pattern** to: `main`.
5. Enable:

   - **Require a pull request before merging**
     - **Require approvals:** 0 (or 1 if you want review).
     - Leave **Dismiss stale pull request approvals** and **Require review from Code Owners** as needed.
   - **Require status checks to pass before merging**
     - **Require branches to be up to date before merging:** optional (recommended: enabled).
     - In **Status checks that are required**, search for and add: **CI** (the name of the GitHub Actions workflow).
   - **Do not allow bypassing the above settings** (if available for your plan).
   - **Restrict who can push to matching branches:** leave empty unless you want to limit pushers.
   - **Allow force pushes:** **Do not allow** (or leave unchecked).
   - **Allow deletions:** **Do not allow** for `main`.

6. Click **Create** (or **Save changes**).

## Result

- All changes to `main` must go through a pull request.
- The **CI** workflow (lint, typecheck, build) must pass before merge.
- Force push to `main` is disabled.
- Deleting the `main` branch is disabled.

## Optional

- **Require linear history:** enable if you want to prevent merge commits.
- **Include administrators:** enable so the same rules apply to admins.
