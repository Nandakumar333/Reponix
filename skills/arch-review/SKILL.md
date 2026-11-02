---
name: arch-review
description: Evaluates system architecture, fitness functions, layer boundaries, and renders Mermaid diagrams for whole repos or single feature flows.
---

# Architecture Review Skill

This skill provides comprehensive instructions, evaluation frameworks, and diagramming standards for analyzing system architecture, assessing architectural fitness, validating layer isolation, and generating production-grade Mermaid visualizations.

It supports both **macro-level system architecture reviews** and **feature-level slice architecture reviews** (e.g. reviewing the isolation and sequence flow of a Login or MFA feature).

---

## 1. Architectural Evaluation Framework

When performing an architectural review, systematically evaluate the system across these core dimensions:

### 1.1 Layer Isolation & Dependency Inversion
- **Standard Dependency Rule:** Source code dependencies must point inward toward higher-level policies (Domain & Application Core).
  - **Ingress / Presentation:** Controllers, routers, CLI commands, GraphQL resolvers. Must never contain business rules or execute raw database queries.
  - **Application / Use Cases:** Orchestrates domain entities and use cases. Defines output ports / repository interfaces.
  - **Domain Core:** Pure business entities, state machines, value objects, domain logic. Has zero external dependencies.
  - **Infrastructure / Persistence:** Repositories, database drivers, external API clients, messaging adapters. Implements interfaces defined by Application/Domain.

### 1.2 Feature Slice Isolation & Boundary Ports
When evaluating a single extracted feature (e.g., *Login Flow*, *MFA Challenge*, *Registration*):
- **Port Identification:** Verify that the feature interacts with external systems exclusively through well-defined interface ports:
  - Data Store Port: `IUserStore` / `ICredentialRepository`
  - Notification Port: `ISmsSender` / `IEmailSender`
  - Token / Crypto Port: `ITokenService` / `IPasswordHasher`
- **Coupling Red Flags:**
  - *Leaky Controller:* Route handlers accessing database context directly (`_context.Users.Where(...)`) instead of delegating to domain services.
  - *Global State Dependency:* Feature relying on mutable static state or thread-local storage rather than explicit parameter passing.
  - *Unbounded Context Leaks:* Authentication flow directly importing shopping cart or billing entities.

### 1.3 Coupling, Cohesion & Instability Index
- **Afferent Coupling ($C_a$):** Number of external classes that depend on this component.
- **Efferent Coupling ($C_e$):** Number of external classes this component depends upon.
- **Instability Index ($I$):**
  $$I = \frac{C_e}{C_a + C_e}$$
- **Target for Feature Slices:** Extracted feature domain cores should have high stability ($I < 0.2$), depending only on pure primitives and boundary interfaces.

### 1.4 Event-Driven Architecture & Messaging Fitness (Kafka / Queues)
When evaluating event-driven systems or asynchronous messaging:
- **Partition Key & Ordering:** Verify that events requiring strict ordering share a deterministic partition key (e.g. `orderId`, `userId`). Flag unpartitioned or randomly partitioned event streams where order matters.
- **Consumer Idempotency:** Verify that event consumers implement deduplication (e.g., unique database constraint or Redis idempotency key check) to safely handle at-least-once delivery.
- **Poison-Pill & DLQ Handling:** Confirm that unprocessable messages are redirected to a Dead Letter Queue (DLQ) after bounded retries with exponential backoff, preventing consumer lag head-of-line blocking.
- **Schema Compatibility:** Ensure event payloads adhere to versioned schemas (Avro, Protobuf, JSON Schema) supporting backward/forward compatibility.

### 1.5 Distributed Caching & Concurrency Fitness (Redis)
When evaluating caching and distributed state:
- **Cache Consistency Strategy:** Identify whether the system uses Cache-Aside, Write-Through, or Write-Behind. Verify that cache invalidation triggers on all mutation paths.
- **Stampede & Thundering Herd Mitigation:** Verify that high-traffic cache misses do not overwhelm the database (using probabilistic early expiration or mutex locks).
- **Distributed Mutex Safety:** When using Redis for locking:
  - Verify that locks have an explicit TTL to prevent deadlocks on crash.
  - Verify that release operations use atomic Lua comparison (`if redis.call('get', KEYS[1]) == ARGV[1] then return redis.call('del', KEYS[1]) end`) to prevent accidentally releasing another process's lock.

---

## 2. Mermaid Diagramming Standards & Syntax Guardrails

### 2.1 Distributed Component & Boundary Diagrams (`graph TD`)
- Isolate the feature's active participants inside explicit subgraphs:
  ```mermaid
  graph TD
      subgraph Ingress ["API & Ingress Tier"]
          OrderRoute["POST /api/v1/orders"]
      end

      subgraph FastPath ["Distributed Caching & Locking Tier"]
          RedisCache[("Redis Cache")]
          RedisLock[("Redis Distributed Lock")]
      end

      subgraph DomainCore ["Order Domain Core"]
          OrderSvc["Order Processing Service"]
          OrderEntity["Order State Guard"]
      end

      subgraph EventBus ["Event Streaming Tier (Kafka)"]
          OrderProducer["Kafka Event Producer"]
          OrderTopic{{"Kafka: orders.events.v1"}}
          OrderDLQ{{"Kafka DLQ: orders.events.dlq"}}
      end

      subgraph PersistencePorts ["Storage & Consumers"]
          OrderDB[("PostgreSQL DB")]
          BillingWorker["Billing Consumer Worker"]
      end

      OrderRoute --> OrderSvc
      OrderSvc <--> RedisCache
      OrderSvc <--> RedisLock
      OrderSvc --> OrderEntity
      OrderSvc --> OrderDB
      OrderSvc --> OrderProducer
      OrderProducer --> OrderTopic
      OrderTopic --> BillingWorker
      BillingWorker -. "On Fatal Error" .-> OrderDLQ
      BillingWorker --> OrderDB
  ```

### 2.2 Multi-Branch Sync & Async Sequence Diagrams (`sequenceDiagram`)
- Model the complete lifecycle of the feature across cache, database, and event topics:
  ```mermaid
  sequenceDiagram
      autonumber
      actor Client
      participant Route as API Gateway / Route
      participant Cache as Redis Cache
      participant Lock as Redis Lock
      participant Svc as Order Service
      participant DB as Database
      participant Kafka as Kafka (orders.events.v1)
      participant Worker as Billing Worker

      Client->>Route: POST /orders (idempotencyKey)
      Route->>Cache: GET idempotency:{key}
      alt Duplicate Request Cached
          Cache-->>Route: Cached Response
          Route-->>Client: 200 OK (Cached)
      else New Request
          Route->>Lock: AcquireLock(lock:order:{id})
          Lock-->>Route: OK
          Route->>Svc: processOrder(payload)
          Svc->>DB: INSERT INTO orders
          Svc->>Kafka: Produce(OrderCreatedEvent)
          Kafka-->>Svc: Ack
          Svc->>Cache: SET idempotency:{key}
          Route->>Lock: ReleaseLock(lock:order:{id})
          Route-->>Client: 201 Created

          Note over Kafka,Worker: Asynchronous Consumer Loop
          Kafka-)Worker: Consume(OrderCreatedEvent)
          Worker->>DB: Record Payment Transaction
          Worker-->>Kafka: Commit Offset
      end
  ```

---

## 3. Market Reference Architecture & Industry Benchmarking Framework

When designing new architectures, evaluating product concepts, or benchmarking against industry standards (e.g. building an Uber/Ola-like ride-hailing app, a streaming platform like Netflix, or a payment engine like Stripe):

### 3.1 Web & Case Study Research Protocol
1. **Search & Source Gathering:** Connect to the web to retrieve engineering blogs (e.g., Uber Engineering, Netflix TechBlog, AWS Architecture Center), technical whitepapers, and system design case studies.
2. **Competitive & Architectural Deconstruction:**
   - **WHAT They Used:** Identify specific infrastructure tiers, data stores (relational, geospatial, time-series), event streaming brokers, and communication protocols (gRPC, WebSockets).
   - **WHY They Used It:** Identify the specific bottlenecks and constraints that necessitated the choice (e.g., why Uber adopted H3 hexagonal indexing over R-Trees; why Redis distributed locking is required to prevent double-booking).
   - **HOW to Implement This:** Define concrete schemas, state machines, distributed locking mechanics, and failure isolation patterns.

### 3.2 Key Industry Benchmarks:
- **Ride-Hailing & Real-Time Dispatch (Uber / Ola):**
  - *Geospatial:* Uber H3 (Resolution 8) / Google S2 for constant-time proximity queries without database locks.
  - *FastPath:* Redis Cluster for driver location cache; Redis Redlock (`SET NX EX`) to guarantee zero-double-dispatch.
  - *Event Streaming:* Apache Kafka with partition key by `driverId` or `tripId` for asynchronous settlement and analytics.
  - *Protocols:* Bidirectional WebSockets / gRPC streaming for sub-second driver GPS pings.

---

## 4. Architecture Review Checklist
- [ ] Feature boundaries are strictly encapsulated with zero leaky controller-to-database bypasses.
- [ ] External dependencies are abstracted behind clean boundary interfaces (Ports).
- [ ] Distributed caching implements safe TTLs and cache-miss fallback paths.
- [ ] Distributed locks use atomic Lua release scripts and bounded timeouts to prevent race conditions.
- [ ] Kafka topics enforce deterministic partition keys and DLQ error routing.
- [ ] Event consumers are verified to be idempotent against duplicate deliveries.
- [ ] Greenfield designs are anchored in verified industry standards (What, Why, How).
- [ ] All Mermaid labels with parentheses or special characters are properly quoted.
