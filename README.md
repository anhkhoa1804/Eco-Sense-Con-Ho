# Eco-Sense Con Ho

Serverless climate monitoring network for Cồn Hô — public climate information platform, citizen science initiative, and eco-tourism support system.

> ⚠️ **Development Status**
>
> Eco-Sense Con Ho is currently under active development.
>
> The public deployment is intended for demonstration, evaluation, and project showcase purposes only. Features, APIs, database schemas, and user interfaces may change without notice during development and testing.

## Live Demo

**Demo Website:** https://eco-sense-con-ho.vercel.app/

### Available Public Pages

* `/` — Home
* `/about` — Project Overview
* `/dashboard` — Climate Dashboard
* `/s/[stationId]` — Station Information Page (QR Access)
* `/report` — Community Environmental Reporting

### Administrative Pages

* `/admin/login` — Operator Authentication
* `/admin` — Operations Console

---

# 1. Product Summary

Eco-Sense Con Ho is an end-to-end environmental monitoring system designed to support climate resilience, citizen science, and sustainable community development on Cồn Hô.

The platform combines:

* Field IoT monitoring stations (ESP32 + LTE modem)
* Secure serverless telemetry ingestion
* PostgreSQL time-series data storage
* Progressive Web Application (PWA)
* Community reporting workflows
* Administrative fleet management tools

Primary goals include:

* Reliable environmental data collection in remote environments
* Public visibility of salinity and water-level conditions
* Climate awareness and citizen science participation
* Long-term environmental monitoring
* Fleet diagnostics and maintenance support
* Research and educational use of climate data

---

# 2. Core Architecture

## Data Flow

1. ESP32 node wakes according to a predefined duty cycle (every 30 minutes).
2. Sensors collect environmental measurements.
3. The node powers the LTE modem and prepares telemetry payloads.
4. Payloads are cryptographically signed.
5. Data is transmitted to Supabase Edge Functions.
6. Edge Functions validate:

   * Device signature
   * Timestamp validity
   * Idempotency constraints
7. Valid records are stored in PostgreSQL.
8. Next.js PWA retrieves and visualizes data for public and administrative users.

## Technology Stack

### Hardware

* ESP32
* A7670C LTE Modem
* SIM7600 LTE Modem

### Backend

* Supabase Edge Functions
* PostgreSQL
* Row Level Security (RLS)
* Supabase Authentication
* Supabase Storage

### Frontend

* Next.js 15
* React 19
* Progressive Web App (PWA)
* TanStack Query
* Tailwind CSS

---

# 3. System Design Principles

## Serverless-First

The platform minimizes always-on infrastructure by leveraging serverless components wherever possible.

Benefits:

* Reduced operational cost
* Simplified deployment
* Improved scalability
* Minimal infrastructure maintenance

## Fault-Tolerant Field Operations

The system is designed for challenging environmental conditions.

Key considerations:

* LTE retry handling
* Packet-loss tolerance
* Sensor fault isolation
* Low-power operation
* Long-duration autonomous deployment

## Offline-First User Experience

Community reporting workflows are designed to operate under unstable connectivity conditions.

Features include:

* Local draft storage
* IndexedDB persistence
* Deferred synchronization
* Future background-sync support

## Security by Design

Security mechanisms are integrated throughout the platform.

Examples:

* Signed telemetry payloads
* Replay attack protection
* Timestamp validation
* Role-based access control
* Database Row Level Security

---

# 4. Repository Structure

```text
.
├── apps/
│   └── web/
│       └── Next.js PWA (Public + Admin)
│
├── services/
│   └── edge-ingestion/
│       └── Supabase Edge Functions
│
├── firmware/
│   └── esp32-node/
│       └── ESP32 Firmware
│
├── infra/
│   └── supabase/
│       ├── SQL Migrations
│       ├── RLS Policies
│       └── Seed Data
│
└── docs/
    ├── IMPLEMENTATION_PLAN.md
    ├── API_CONTRACTS.md
    ├── AUTHORIZATION_MODEL.md
    ├── PILOT_BOOTSTRAP.md
    ├── DEPLOYMENT_PACKAGE.md
    ├── FIELD_TEST_PLAN.md
    └── RUNBOOKS.md
```

---

# 5. Data Domains

Main entities:

* users
* stations
* station_assignments
* environmental_readings
* environmental_events
* station_health_logs
* damage_logs
* crop_thresholds

## Key Constraints

### Environmental Readings

* `message_id` must be unique.
* Used for ingestion idempotency.

### Health Logs

* Operational diagnostics are separated from environmental measurements.
* Enables independent analysis of station performance.

### Access Control

* All business data is protected using Supabase RLS policies.

---

# 6. Security Model

## IoT Ingestion Security

Requirements:

* HMAC-SHA256 payload signatures
* Timestamp validation window ≤ 5 minutes
* Unique message identifiers
* Replay protection
* Duplicate request suppression

## Application Security

Requirements:

* Supabase Auth
* Role-based access control
* Row Level Security
* Signed upload workflows
* Protected administrative routes

---

# 7. User Experience Scope (Public MVP)

## Public Access (No Login Required)

### Home

`/`

Project introduction and community overview.

### About

`/about`

Background information about Cồn Hô and the monitoring initiative.

### Dashboard

`/dashboard`

Public climate monitoring dashboard displaying environmental telemetry.

### Station Page

`/s/[stationId]`

QR-accessible station information and measurements.

### Community Reports

`/report`

Citizen science and environmental issue reporting.

---

## Administrative Access

### Admin Login

`/admin/login`

Magic-link based authentication.

### Operations Console

`/admin`

Fleet diagnostics and operational management.

---

## Deferred Features

Planned for future releases:

* Farmer accounts
* Advanced analytics
* Offline report synchronization
* Photo uploads
* Automated alert subscriptions

---

# 8. Documentation

Project documentation includes:

* `docs/API_CONTRACTS.md`

  * IoT ingestion specification

* `docs/AUTHORIZATION_MODEL.md`

  * Authentication and authorization model

* `docs/PILOT_BOOTSTRAP.md`

  * Deployment and pilot setup procedures

* `docs/IMPLEMENTATION_PLAN.md`

  * Development roadmap

* `firmware/esp32-node/docs/FIRMWARE_SPEC.md`

  * Firmware lifecycle specification

---

# 9. Success Metrics

The project is considered successful when:

* Accepted telemetry payloads are persisted without data loss.
* Duplicate LTE retries do not create duplicate records.
* Sensor failures are explicitly reported.
* Store-and-forward mechanisms preserve data during outages.
* Nodes remain operational during adverse weather conditions.
* Pilot deployments achieve stable operation over extended periods.
* Community reports can be captured and synchronized successfully.

---

# 10. Current Status

## Backend

* Supabase migrations 001–012 deployed
* Edge ingestion service operational
* Row Level Security configured
* Integration tests passing

## Frontend

Public MVP available:

* Home
* About
* Dashboard
* QR Station Pages
* Community Reports
* Admin Login

## Firmware

* Telemetry ingestion contract implemented
* Sensor fault reporting implemented
* HMAC validation supported
* Store-and-forward workflow under development

---

# 11. Implemented Artifacts

## Monorepo Components

* `apps/web`
* `services/edge-ingestion`
* `infra/supabase`
* `firmware/esp32-node`

## Implemented Features

* Server-side telemetry dashboard
* Repository abstraction layer
* Supabase migrations
* Pilot seed data
* CI/CD verification pipeline

### Edge Ingestion Features

* HMAC verification
* Timestamp drift validation
* Idempotent ingestion
* Sensor fault handling
* Audit logging
* Telemetry/event separation

---

# 12. Local Development

## Install Dependencies

```bash
npm install
```

## Run Validation

```bash
npm run check
```

## Run Mock Ingestion

```bash
npm run mock:ingest
```

## Run Simulator

```bash
npm run simulator
```

## Start Dashboard

```bash
npm run dashboard
```

Open:

```text
http://localhost:4173
```

---

# 13. Environment Variables

Required variables for local development:

```env
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=
```

Additional deployment-specific variables may be required depending on infrastructure configuration.

---

# 14. License

This repository is currently maintained as part of the Eco-Sense Con Ho climate monitoring initiative.

All rights reserved unless otherwise specified.
