---
starter_id: 10x-astro-starter
package_manager: pnpm
project_name: 10x-new-flat
hints:
  language_family: js
  team_size: solo
  deployment_target: cloudflare-pages
  ci_provider: github-actions
  ci_default_flow: auto-deploy-on-merge
  bootstrapper_confidence: first-class
  path_taken: standard
  quality_override: false
  self_check_answers: null
  has_auth: true
  has_payments: false
  has_realtime: false
  has_ai: true
  has_background_jobs: false
---

## Why this stack

10xNewFlat is a small, after-hours web app MVP with login, saved offer entries, and offer-content extraction, so the registry-compatible 10x Astro Starter gives the fastest path to auth, database, TypeScript contracts, and Cloudflare deployment. The selected starter is React-based, but the project preference is to replace React islands with SolidJS after bootstrap while keeping the starter's Supabase, Cloudflare, and project structure. GitHub Actions with auto-deploy-on-merge keeps the release path simple for a solo build.
