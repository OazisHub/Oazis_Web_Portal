# Oazis Web Portal — Team Onboarding

This file defines the baseline setup for shared team work in Codex/GitHub environments.

## 1. Repository Access
- Repo: `https://github.com/OazisHub/Oazis_Web_Portal`
- Required role:
  - `Write` for contributors
  - `Maintain` for tech leads/release owners
- `main` branch policy:
  - Pull requests only
  - Direct push disabled
  - At least 1 review required

## 2. Identity and Git Setup
Run locally once:

```bash
git config --global user.name "YOUR_NAME"
git config --global user.email "YOUR_GITHUB_EMAIL"
```

Set repository remote (SSH preferred):

```bash
cd /Users/mg/Documents/S.Polonium/OAZIS/Oazis_Web_Portal
git remote set-url origin git@github.com:OazisHub/Oazis_Web_Portal.git
git remote -v
```

## 3. Secrets and Environments
Use environment-specific secrets only; never commit real secrets.

Environments:
- `dev`
- `stage`
- `prod`

Secret ownership:
- Stored in GitHub Environments / org secret manager
- Rotated by owner/admin

Never commit:
- `.env`
- API keys
- private keys

Keep only:
- `.env.example`

## 4. Local Bootstrap

```bash
cd /Users/mg/Documents/S.Polonium/OAZIS/Oazis_Web_Portal
make setup
make up
make smoke
```

Portal URL:
- `http://localhost:8103`

## 5. Team Workflow
1. Create feature branch: `feature/<short-scope>`
2. Implement one intention per PR
3. Run local checks (`make smoke`)
4. Open PR to `main`
5. Merge only after CI + review

## 6. CI Expectations
Current CI validates:
- Docker compose shape
- Python/Node syntax
- Smoke flow

CI file:
- `/Users/mg/Documents/S.Polonium/OAZIS/.github/workflows/classic-version-ci.yml`

## 7. Codex Environment Rules
- Use shared environment credentials, not personal one-off tokens
- Prefer SSH auth for git operations in team context
- Keep runtime deterministic (`.env.example`, Make targets)
- Keep contracts stable in `shared/contracts`

## 8. Definition of Ready (for new team member)
A team member is ready when they can:
1. Pull repository
2. Run `make up`
3. Open `http://localhost:8103`
4. Run `make smoke` successfully
5. Create PR with one focused intent
