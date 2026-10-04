---
name: modernization
description: Generates exhaustive, production-grade target-neutral software specifications, directory scaffolds, database DDL, boundary ports, algorithmic logic flows, and migration blueprints for recreating entire repositories or single feature flows.
---

# Modernization & System Reconstruction Skill

This skill provides comprehensive architectural guidelines, specification standards, and implementation methodologies for decomposing legacy codebases, authoring target-neutral reconstruction blueprints, and executing ground-up recreation of entire repositories or isolated single-feature vertical slices.

It supports both **whole-repository ground-up reconstruction** and **single-feature slice extraction and recreation** (e.g. extracting an IdentityServer Login, MFA flow, Checkout pipeline, or Real-time dispatch engine into a modern, standalone modular microservice or package).

---

## 1. The Core Philosophy of System Reconstruction

A system or feature reconstruction specification is successful **only if an AI coding agent or new engineering team can recreate the entire software component from scratch without reading the legacy code and without making architectural assumptions.**

### Operating Principles
1. **Target-Neutral Business Invariants:** Decouple business rules from legacy framework idioms (e.g., stripping ASP.NET MVC pipeline quirks or Spring Security filter lifecycles into pure domain rules).
2. **Hexagonal Ports & Adapters Architecture:** Every recreated system or feature must strictly isolate Inbound Ports (use cases), Domain Core (entities/FSMs), Outbound Ports (repositories/caches/brokers), and Infrastructure Adapters.
3. **Zero Hand-Waving Detail:** Every database table must have complete SQL DDL; every business rule must have step-by-step algorithmic pseudo-code; every concurrency-sensitive path must have exact Redis lock key patterns and Lua release scripts.
4. **Guaranteed Data & Behavioral Parity:** Recreations must match legacy verified behavior, handling both happy paths and edge cases (rate limits, lockout thresholds, open-redirect checks, and transaction boundaries).

---

## 2. The 7 Pillars of Complete Reconstruction Specifications

When authoring `reconstruction-spec.md` for a whole repo or feature slice, systematically formulate these 7 pillars:

### Pillar 1: Target Project Scaffolding & Directory Layout
Provide the exact, complete target file tree for the recreated repository or feature:
```
target-component/
├── .env.example                              # Validated environment configuration template
├── Dockerfile                                # Multi-stage container build
├── docker-compose.yml                        # App, PostgreSQL, Redis, Kafka local harness
├── package.json / Cargo.toml / go.mod        # Pinned runtime and development dependencies
├── tsconfig.json                             # Strict compiler configuration
├── src/
│   ├── index.ts                              # Bootstrap & DI container assembly
│   ├── domain/                               # Pure Domain Core (Zero external framework deps)
│   │   ├── entities/                         # Aggregate roots and entity models
│   │   ├── value-objects/                    # Immutable value objects
│   │   ├── events/                           # Domain event definitions
│   │   └── exceptions/                       # Domain error types
│   ├── application/                          # Application Orchestration & Ports
│   │   ├── ports/
│   │   │   ├── inbound/                      # Use case command/query interfaces
│   │   │   └── outbound/                     # Repository, Cache, Mutex, and Gateway interfaces
│   │   ├── dtos/                             # Input/Output DTO schemas
│   │   └── use-cases/                        # Use case orchestration implementations
│   ├── infrastructure/                       # Outbound Adapters (External Implementations)
│   │   ├── persistence/                      # Database repositories, migrations, ORM schemas
│   │   ├── cache/                            # Redis cache & distributed lock adapters
│   │   ├── messaging/                        # Kafka event producer & consumer adapters
│   │   └── gateways/                         # Third-party SDK wrappers (SMS, Email, Payment)
│   └── interfaces/                           # Inbound Adapters (Driving Ingress)
│       └── http/                             # REST/GraphQL route handlers, middleware, DTO validation
└── tests/
    ├── fixtures/                             # Golden master test vectors
    ├── unit/                                 # Pure domain unit tests
    └── integration/                          # Containerized end-to-end integration tests
```

### Pillar 2: Target-Neutral Domain Models, Value Objects & FSMs
- **Pure Entities:** Model entities with strict typing, validation invariants, and immutability rules.
- **Formal Finite State Machines (FSM):**
  - Document every state (e.g. `PENDING`, `AUTHORIZED`, `SETTLED`, `CANCELLED`).
  - Document transition guards (pre-conditions that must hold for transition).
  - Document side-effects (e.g. event emissions, cache updates, audit logs).

### Pillar 3: Inbound & Outbound Boundary Interface Ports
- **Inbound (Primary) Ports:** Interfaces triggered by ingress controllers:
  ```typescript
  export interface IExecuteCheckoutUseCase {
    execute(command: CheckoutCommand): Promise<CheckoutResult>;
  }
  ```
- **Outbound (Secondary) Ports:** Interfaces abstracting infrastructure:
  ```typescript
  export interface IOrderRepository {
    findById(id: string): Promise<Order | null>;
    save(order: Order): Promise<void>;
  }
  export interface IDistributedLock {
    acquire(key: string, ttlSeconds: number): Promise<{ acquired: boolean; token: string }>;
    release(key: string, token: string): Promise<boolean>;
  }
  export interface IEventPublisher {
    publish<T>(topic: string, partitionKey: string, event: T): Promise<void>;
  }
  ```

### Pillar 4: Ingress Contracts & Database Persistence DDL
- **OpenAPI 3.1 & RPC Specs:** HTTP verbs, routes, headers, query parameters, request schemas, status codes, and RFC 7807 problem details.
- **Complete SQL DDL:**
  ```sql
  CREATE TABLE IF NOT EXISTS orders (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      customer_id UUID NOT NULL,
      status VARCHAR(32) NOT NULL DEFAULT 'PENDING',
      total_amount_cents BIGINT NOT NULL CHECK (total_amount_cents >= 0),
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
  );
  CREATE INDEX idx_orders_customer_id ON orders (customer_id);
  ```

### Pillar 5: Algorithmic Step-by-Step Logic Flows
Never write "handle authentication" or "process the order". Write numbered step-by-step algorithms:
```text
1. Sanitize and validate incoming payload against schema.
2. Verify rate limit counter in Redis; reject with HTTP 429 if exceeded.
3. Acquire distributed mutex lock on "lock:resource:{id}" with 10s TTL.
4. Fetch entity state from repository; hydrate domain aggregate.
5. Evaluate domain invariants (e.g. credential check, balance check).
6. Execute state transition; append domain event to Transactional Outbox table.
7. Commit database transaction.
8. Invalidate Redis cache entry; release distributed mutex lock in finally block.
9. Format response DTO and emit security cookies / JWTs.
10. Trigger asynchronous event relay to Kafka.
```

### Pillar 6: Data Migration & Zero-Downtime Cutover
- **Dual-Write with Transactional Outbox:** Both systems or new system write to primary and outbox to avoid split-brain.
- **Rehash-on-Login (Zero-Reset Password Modernization):**
  - Verify legacy hash (e.g. PBKDF2), compute Argon2id on success, and asynchronously upgrade the database hash.
- **Strangler Fig Proxy Routing:** API Gateway routes traffic progressively (10% &rarr; 50% &rarr; 100%) with response diffing on shadow traffic.

### Pillar 7: Golden Master Parity Test Suite & AI Implementation Runbooks
- **Parity Test Fixtures:** Concrete JSON input and output vectors covering happy path and error cases.
- **AI Coding Implementation Runbook:** Sequential, promptable micro-tasks for Phase 0 (Scaffold), Phase 1 (Domain), Phase 2 (Persistence), Phase 3 (FastPath), Phase 4 (Ingress), and Phase 5 (Cutover).

---

## 3. Single-Feature Extraction Review Checklist
- [ ] Complete directory tree and file paths explicitly specified.
- [ ] Inbound and Outbound boundary ports fully typed with zero external framework leaks.
- [ ] Executable database SQL DDL with constraints, foreign keys, and indexes included.
- [ ] Redis key templates, TTLs, and atomic Lua mutex scripts defined.
- [ ] Step-by-step numbered algorithmic pseudo-code provided for all business rules.
- [ ] Golden Master test fixtures with concrete JSON payloads included.
- [ ] Phased AI coding implementation runbook provided from Phase 0 to Phase 5.
- [ ] Rehash-on-login or credential migration strategy avoids forcing user password resets.
- [ ] Explicit rollback mechanisms and emergency gateway fallback switches defined.
