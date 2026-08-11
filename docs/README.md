# Eco-Sense Cồn Hô Product Handbook

This directory is the source of truth for Eco-Sense Cồn Hô. It is written for engineers, designers, AI coding agents, judges, operators, and maintainers who need to understand both the product philosophy and the implementation rules.

Eco-Sense is not a generic IoT dashboard. It is a calm environmental intelligence platform for a real coastal farming community in Vietnam.

## How to read this handbook

Read in this order when onboarding or asking an AI agent to build UI:

1. Understand the product and users.
2. Understand the UX direction.
3. Use tokens, components, page blueprints, interactions, copy, and empty states to implement without guessing.
4. Check accessibility, performance, architecture, authorization, API, pilot, and QA gates.

## Handbook map

| Document | Purpose |
|----------|---------|
| [`PRODUCT_CONTEXT.md`](PRODUCT_CONTEXT.md) | Vision, personas, positioning, emotional tone, and decision filter. |
| [`VISUAL_REFERENCES.md`](VISUAL_REFERENCES.md) | What Eco-Sense learns from Linear, Supabase, Windy, Our World in Data, Mobbin, and others. |
| [`VISUAL_LANGUAGE.md`](VISUAL_LANGUAGE.md) | Product-level visual direction for public and admin surfaces. |
| [`UX_PRINCIPLES.md`](UX_PRINCIPLES.md) | Mobile-first UX principles, public/admin distinction, charts, motion, and state philosophy. |
| [`DESIGN_SYSTEM.md`](DESIGN_SYSTEM.md) | Design system governance and how tokens/components fit together. |
| [`DESIGN_TOKENS.md`](DESIGN_TOKENS.md) | Concrete spacing, typography, color, radius, elevation, motion, z-index, and breakpoint tokens. |
| [`COMPONENT_SPECIFICATION.md`](COMPONENT_SPECIFICATION.md) | Implementation specs for MetricCard, StationCard, charts, buttons, forms, dialogs, toasts, skeletons, and navigation. |
| [`PAGE_BLUEPRINTS.md`](PAGE_BLUEPRINTS.md) | Required page hierarchy and responsive layout for home, dashboard, station detail, report, login, admin, and offline pages. |
| [`INTERACTION_GUIDELINES.md`](INTERACTION_GUIDELINES.md) | Motion, hover, focus, loading, dialogs, drawers, skeletons, chart interactions, and reduced motion. |
| [`COPYWRITING_GUIDE.md`](COPYWRITING_GUIDE.md) | Vietnamese and English terminology, status wording, error wording, CTAs, and alert formulas. |
| [`EMPTY_STATES.md`](EMPTY_STATES.md) | Reusable empty, offline, no-data, permission, loading, slow-network, and fault states. |
| [`ACCESSIBILITY_PERFORMANCE.md`](ACCESSIBILITY_PERFORMANCE.md) | WCAG AA, field usability, keyboard behavior, chart accessibility, data freshness, and performance. |
| [`ARCHITECTURE.md`](ARCHITECTURE.md) | System architecture, data flow, domains, security boundaries, and reliability model. |
| [`API_CONTRACTS.md`](API_CONTRACTS.md) | Telemetry ingestion contract for devices and backend services. |
| [`AUTHORIZATION_MODEL.md`](AUTHORIZATION_MODEL.md) | Public/admin/device access boundaries, roles, RLS expectations, and audit behavior. |
| [`IMPLEMENTATION_PLAN.md`](IMPLEMENTATION_PLAN.md) | Delivery roadmap from product foundation to production showcase. |
| [`PILOT_BOOTSTRAP.md`](PILOT_BOOTSTRAP.md) | Field deployment checklist for station setup, QR pages, calibration, and pilot operations. |
| [`TECHNICAL_QA_CHECKLIST.md`](TECHNICAL_QA_CHECKLIST.md) | Release gates for UX, accessibility, data integrity, security, and field readiness. |
| [`UI_AUDIT_CHECKLIST.md`](UI_AUDIT_CHECKLIST.md) | Pre-commit UI checklist for hierarchy, spacing, components, states, accessibility, and responsive behavior. |
| [`VISUAL_DO_NOTS.md`](VISUAL_DO_NOTS.md) | Explicit anti-patterns that block noisy, generic, or inaccessible UI decisions. |
| [`UI_REVIEW_PLAYBOOK.md`](UI_REVIEW_PLAYBOOK.md) | Repeatable read-audit-implement-review workflow for humans and AI coding agents. |

## Non-negotiable product rules

- **Clarity above beauty:** if a user cannot immediately understand the environmental state, the design has failed.
- **Calm technology:** avoid noisy colors, flashing alerts, unnecessary animation, and decorative UI.
- **Trustworthy data:** environmental readings affect real-world decisions, so precision and consistency matter.
- **Mobile first:** design from 320px upward because farmers and visitors often use phones outdoors.
- **Accessible by default:** large targets, visible focus, semantic HTML, readable contrast, and simple language are required.
- **Performance is UX:** skeletons, caching, progressive rendering, and stable layouts are product features.

## Implementation workflow

Before adding or changing a feature:

1. Identify the primary persona in [`PRODUCT_CONTEXT.md`](PRODUCT_CONTEXT.md).
2. Match the surface type in [`UX_PRINCIPLES.md`](UX_PRINCIPLES.md): public, QR station, report, or admin.
3. Choose the page structure from [`PAGE_BLUEPRINTS.md`](PAGE_BLUEPRINTS.md).
4. Use component specs from [`COMPONENT_SPECIFICATION.md`](COMPONENT_SPECIFICATION.md).
5. Use token values from [`DESIGN_TOKENS.md`](DESIGN_TOKENS.md).
6. Use interactions from [`INTERACTION_GUIDELINES.md`](INTERACTION_GUIDELINES.md).
7. Use copy from [`COPYWRITING_GUIDE.md`](COPYWRITING_GUIDE.md) and empty states from [`EMPTY_STATES.md`](EMPTY_STATES.md).
8. Validate accessibility and performance with [`ACCESSIBILITY_PERFORMANCE.md`](ACCESSIBILITY_PERFORMANCE.md).
9. Confirm architecture, authorization, API, pilot, and QA expectations before release.
10. Before commit or handoff, run [`UI_AUDIT_CHECKLIST.md`](UI_AUDIT_CHECKLIST.md), check [`VISUAL_DO_NOTS.md`](VISUAL_DO_NOTS.md), and follow [`UI_REVIEW_PLAYBOOK.md`](UI_REVIEW_PLAYBOOK.md).

If documentation and code disagree, pause and update one of them intentionally. Do not let the product philosophy drift silently.