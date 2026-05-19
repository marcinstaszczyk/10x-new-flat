---
project: "10xNewFlat"
context_type: greenfield
product_type: web-app
target_scale:
  users: small
  qps: low
  data_volume: small
timeline_budget:
  mvp_weeks: 3
  hard_deadline: null
  after_hours_only: true
created: 2026-05-19
updated: 2026-05-19
checkpoint:
  current_phase: 8
  phases_completed: [1, 2, 3, 4, 5, 6, 7]
  gray_areas_resolved:
    - topic: "context type"
      decision: "greenfield"
    - topic: "primary persona"
      decision: "Buyer is the MVP persona; renter and investor are post-MVP."
    - topic: "product insight"
      decision: "Use a knowledge base of questions, aggregate offer data into organized flat attributes, and avoid asking about facts already present unless doubts occur."
    - topic: "access model"
      decision: "Buyers log in with Google auth, data is shared between devices, buyer is the primary MVP role, a fixed base question list is copied on account creation, buyers can add personal questions and notes, admin-managed question base is nice-to-have, and member/guest roles are out of MVP."
    - topic: "MVP flow"
      decision: "Buyer logs in, adds a flat offer, pastes offer-page content into a textarea, the system transforms pasted content into question and answer form, and the system displays unanswered questions."
    - topic: "timeline"
      decision: "Three weeks of after-hours work is realistic and likely conservative."
    - topic: "business rule"
      decision: "The app maps extracted offer information against a buyer-specific question base, treats matched facts as answered, surfaces unanswered questions, and flags uncertain or unmapped information for review."
    - topic: "quality properties"
      decision: "Offer extraction should return a usable result within 60 seconds; pasted offer content is visible only to the logged-in buyer; buyer can delete a flat offer and its extracted content; preparation flow must be efficient on PC in MVP."
    - topic: "product framing"
      decision: "Build a web app for a handful of users; no domain-rule change expected at 100x the initial scale; after-hours work; external September 2026 deadline with exact date TBD."
    - topic: "non-goals"
      decision: "MVP excludes mobile app, offer comparison, automatic scoring or evaluation of answers, closed yes/no questionnaire conversion, link-based offer import, and admin UI for question base management."
  frs_drafted: 9
  quality_check_status: accepted
---

# Shape Notes

Seed source: `idea-notes.md`

## Vision & Problem Statement

Preparing questions and topics for a flat viewing takes time, and it is easy for a buyer to miss an important topic before or during the viewing.

The product combines a knowledge base of what generally should be asked with automatic aggregation of offer data into organized flat attributes. It should avoid asking about information already available in the offer unless doubts occur.

## User & Persona

Primary persona: buyer preparing for a flat viewing.

Post-MVP personas: renter and investor.

## Access Control

Buyers log in with Google auth as the primary login method.

Buyer data is shared between devices, including PC and mobile Android.

MVP role model:
- Buyer is the primary MVP role.
- On account creation, the app copies a fixed base question list to the buyer.
- Buyers can add personal questions and notes.

Nice-to-have access capability:
- Admin-managed base question list.

Out of MVP:
- Member roles.
- Guest roles.

## Success Criteria

### Primary

- Buyer can prepare a useful question list for the first flat in less than 30 minutes.
- Buyer can prepare a useful question list for later flats in less than 10 minutes.

### Secondary

- Questions are grouped and ordered in a way that feels natural during a viewing conversation.

### Guardrails

- The app does not invent offer facts; uncertain extracted values are marked as unknown or doubtful.
- The app does not ask about facts already present in the offer unless the extracted answer is uncertain or suspicious.

## MVP Flow

1. Buyer logs in.
2. Buyer adds a new flat offer.
3. Buyer pastes offer-page content into a textarea.
4. System transforms the pasted offer content into question and answer form.
5. System displays unanswered questions.

## Functional Requirements

### Authentication & Account Setup

- FR-001: Buyer can log in with Google. Priority: must-have
  > Socrates: Counter-argument considered: Google-only login may limit buyers who prefer another login method. Resolution: kept for MVP; adding more login options is post-MVP.
- FR-002: System can copy a fixed base question list to the buyer on account creation. Priority: must-have
  > Socrates: Counter-argument considered: copied question lists can become stale if the base improves later. Resolution: kept for MVP; later synchronization or update handling is post-MVP.

### Offer Preparation

- FR-003: Buyer can create a flat offer entry. Priority: must-have
  > Socrates: Counter-argument considered: a single pasted analysis without saved offer entries might be enough for MVP. Resolution: kept as written.
- FR-004: Buyer can paste offer-page content into a flat offer entry. Priority: must-have
  > Socrates: Counter-argument considered: manual copy-paste may be clumsy, especially on mobile. Resolution: kept for MVP; pasting a link is a post-MVP extension.
- FR-005: System can transform pasted offer content into question and answer form. Priority: must-have
  > Socrates: Counter-argument considered: extraction quality may be unreliable enough to damage trust. Resolution: kept for MVP; deeper quality handling is a post-MVP problem.
- FR-006: Buyer can review extracted question and answer pairs. Priority: must-have
  > Socrates: Counter-argument considered: review can add friction before value. Resolution: kept; the review step becomes natural as the product extends past MVP.
- FR-007: Buyer can see unanswered questions for a flat offer. Priority: must-have
  > Socrates: Counter-argument considered: showing only unanswered questions may hide useful context already known from the offer. Resolution: kept, and added a separate unmapped-information field so extracted context is not lost.
- FR-008: Buyer can see offer information that was extracted but not mapped to any base question. Priority: must-have
  > Socrates: Counter-argument considered: unmapped information can create noise if it is not actionable. Resolution: kept for MVP so useful extracted information is not silently lost.
- FR-009: Buyer can add, edit, or remove personal questions and notes. Priority: must-have
  > Socrates: Counter-argument considered: editing can grow into a full notes app. Resolution: kept for now, but this FR can be removed from MVP later if needed.

## User Stories

### US-01: Buyer prepares viewing questions from pasted offer content

- **Given** a buyer is logged in
- **When** they create a flat offer entry and paste offer-page content
- **Then** they see extracted question and answer pairs and a list of unanswered questions

#### Acceptance Criteria

- Extracted answers are reviewable before the viewing.
- Unanswered questions are visible separately.
- Uncertain or suspicious extracted values are marked as unknown or doubtful.
- Facts already present in the offer are not repeated as questions unless doubt occurs.

## Business Logic

The app maps extracted offer information against a buyer-specific question base, treats matched facts as answered, surfaces unanswered questions, and flags uncertain or unmapped information for review.

The rule consumes the fixed base question list copied to the buyer, the buyer's personal questions, and pasted offer-page content.

The rule outputs extracted question and answer pairs, unanswered questions, uncertain or doubtful extracted facts, and extracted but unmapped offer information. The buyer encounters these outputs after pasting offer-page content into a flat offer entry.

## Non-Functional Requirements

- Offer extraction returns a usable result within 60 seconds.
- Pasted offer content is visible only to the logged-in buyer.
- Buyer can delete a flat offer and its extracted content.
- Preparation flow is efficient on PC in MVP.

## Product Framing

Product type: web app.

Initial scale: just the owner or a handful of users.

Scale note: no domain-rule change is expected at 100x the initial scale.

Timeline: after-hours work, with an external September 2026 deadline. Exact date is TBD.

## Non-Goals

- No mobile app in MVP; mobile is explicitly post-MVP.
- No offer comparison in MVP; the first version focuses on preparing one flat viewing at a time.
- No automatic scoring or evaluation of answers in MVP; the buyer decides what an answer means.
- No closed yes/no questionnaire conversion in MVP; questions remain open enough for a viewing conversation.
- No link-based offer import in MVP; the buyer pastes offer content manually.
- No admin UI for question base management in MVP; the base list is fixed for the first version.

## Open Questions

1. **What is the exact external September 2026 deadline date?** Owner: user. Block: no.

## Quality Cross-Check

- Access Control: present.
- Business Logic: present.
- Project artifacts: present.
- Timeline-cost acknowledgement: present.
- Non-Goals: present.
- Preserved behavior: n/a for greenfield.

Quality check status: accepted.
