---
project: "10xNewFlat"
version: 1
status: draft
created: 2026-05-24
context_type: greenfield
product_type: web-app
target_scale:
  users: small
  qps: low
  data_volume: small
timeline_budget:
  mvp_weeks: 3
  hard_deadline: 2026-09-12
  after_hours_only: true
---

# 10xNewFlat PRD

## Vision & Problem Statement

Preparing questions and topics for a flat viewing takes time, and it is easy for a buyer to miss an important topic before or during the viewing.

The product combines a knowledge base of what generally should be asked with automatic aggregation of offer data into organized flat attributes. It should avoid asking about information already available in the offer unless doubts occur.

## User & Persona

Primary persona: buyer preparing for a flat viewing.

### Secondary persona

Post-MVP personas: renter and investor.

## Success Criteria

### Primary

- Buyer can prepare a useful question list for the first flat in less than 30 minutes.
- Buyer can prepare a useful question list for later flats in less than 10 minutes.

### Secondary

- Questions are grouped and ordered in a way that feels natural during a viewing conversation.

### Guardrails

- The product does not invent offer facts; uncertain extracted values are marked as unknown or doubtful.
- The product does not ask about facts already present in the offer unless the extracted answer is uncertain or suspicious.

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

## Functional Requirements

### Authentication & Account Setup

- FR-001: Buyer can log in. Priority: must-have
  > Socrates: Counter-argument considered: limiting login to one provider may limit buyers who prefer another login method. Resolution: kept for MVP; adding more login options is post-MVP.
- FR-002: System can copy a fixed base question list to the buyer when they first open their question base. Priority: must-have
  > Socrates: Counter-argument considered: copied question lists can become stale if the base improves later. Resolution: kept for MVP; repeat visits preserve the buyer's initialized copy, template changes do not synchronize automatically, and explicit reset can replace the entire personal list with the currently active base.

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

## Non-Functional Requirements

- Offer extraction returns a usable result within 60 seconds.
- Pasted offer content is visible only to the logged-in buyer.
- Buyer can delete a flat offer and its extracted content.
- Preparation flow is efficient on desktop in MVP.

## Business Logic

Extracted offer information is mapped against a buyer-specific question base, matched facts are treated as answered, unanswered questions are surfaced, and uncertain or unmapped information is flagged for review.

The rule consumes the fixed base question list copied to the buyer on first question-base visit, the buyer's personal questions, and pasted offer-page content.

The rule outputs extracted question and answer pairs, unanswered questions, uncertain or doubtful extracted facts, and extracted but unmapped offer information. The buyer encounters these outputs after pasting offer-page content into a flat offer entry.

## Access Control

Buyers log in before accessing saved flat offers, copied base questions, personal questions, or notes.

Buyer data is shared between supported devices.

MVP role model:
- Buyer is the primary MVP role.
- When the buyer first opens their question base, the product copies the fixed base question list to the buyer.
- Repeat question-base visits preserve the initialized personal copy; template changes do not synchronize automatically.
- Buyers can explicitly reset the entire personal question list to the currently active base after confirmation.
- Buyers can add personal questions and notes.

Nice-to-have access capability:
- Admin-managed base question list.

Out of MVP:
- Member roles.
- Guest roles.

## Non-Goals

- No mobile app in MVP; mobile is explicitly post-MVP.
- No offer comparison in MVP; the first version focuses on preparing one flat viewing at a time.
- No automatic scoring or evaluation of answers in MVP; the buyer decides what an answer means.
- No closed yes/no questionnaire conversion in MVP; questions remain open enough for a viewing conversation.
- No link-based offer import in MVP; the buyer pastes offer content manually.
- No admin UI for question base management in MVP; the base list is fixed for the first version.

## Open Questions

None
