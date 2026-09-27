---
name: graphify
description: Extracts codebase relationship graphs, import trees, call hierarchies, feature vertical slices, and file coupling metrics.
---

# Graphify Skill

This skill provides comprehensive instructions, query patterns, and extraction methodologies for building, querying, and analyzing codebase relationship graphs, import trees, execution call paths, and structural coupling metrics.

It supports both **whole-repository macro graphs** and **feature-scoped vertical slice subgraphs** (e.g. isolating only the Login flow, MFA flow, or Registration workflow).

---

## 1. Core Graph Extraction Operations

When analyzing repository structure with Graphify, execute these core graph operations:

### 1.1 Import Dependency Graph Traversal
- **Language-Specific Import Resolution:**
  - **JavaScript / TypeScript:** Parse ESM `import ... from '...'` and CommonJS `require('...')`. Resolve `tsconfig.json` path aliases (`@/`, `~components/`), monorepo package references (`@repo/core`), and relative paths (`./`, `../`).
  - **Python:** Parse `import x` and `from package.module import y`. Resolve absolute vs relative imports (`from .services import ...`).
  - **Java / Kotlin:** Parse package declarations and `import` statements. Map Maven/Gradle module dependencies.
  - **C# / .NET:** Parse `using ...` directives, project references (`.csproj`), and NuGet package dependencies.
  - **Go:** Parse `import (...)` blocks and match against `go.mod` module path.
  - **Rust:** Parse `use crate::...`, `use super::...`, and external crates from `Cargo.toml`.
- **Classification of Edges:**
  - **Internal Edge:** File A depends on File B within the same repository.
  - **Monorepo Edge:** Package A depends on Package B in a sibling workspace directory.
  - **Third-Party Edge:** File A depends on an external package from package manager (npm, PyPI, NuGet, Crates, Maven).

### 1.2 Feature Vertical Slice Extraction Algorithm
When the goal is to extract a single feature (e.g., *IdentityServer Login Flow*, *MFA Verification*, *Registration*):
1. **Identify Seed Ingress Nodes ($S$):** The entry point routes, controllers, or methods triggering the feature:
   $$S = \{ \text{AccountController.Login}, \text{MfaController.Verify} \}$$
2. **Forward Reachability Traversal (Forward BFS/DFS):**
   - Traverse all outgoing calls, type usages, and dependencies reachable from $S$:
     $$\text{Controller} \longrightarrow \text{Domain Service} \longrightarrow \text{PasswordHasher / SecurityProvider} \longrightarrow \text{UserStore} \longrightarrow \text{DB Entity}$$
3. **Prune at External Domain Boundaries:**
   - Stop traversal at external bounded contexts (e.g., Billing, Catalog, Notification Queue) by replacing concrete dependencies with clean interface boundaries (`ISmsGateway`, `IUserRepository`).
4. **Isolate Feature Subgraph ($G_{\text{feature}}$):**
   - The resulting subgraph contains *only* the nodes, data models, and rules necessary for this feature to execute independently.

### 1.3 Call Hierarchy & Route-to-Data Tracing
- **Entry-Point to Sink Pathfinding:**
  - Trace execution paths from public ingress points down to terminal data sinks across synchronous and asynchronous hops:
    $$\text{Ingress Route Handler} \longrightarrow \text{Controller} \longrightarrow \text{Domain Service} \longrightarrow \text{Repository} \longrightarrow \text{Database Client}$$
- **Distributed & Asynchronous Edge Resolution:**
  - **Direct Synchronous Calls:** Explicit function calls (`foo()`) &rarr; Direct edge.
  - **Dependency Injection (DI) bindings:** (`@Inject(OrderService)`, `builder.Services.AddScoped<IUserStore, UserStore>()`) &rarr; Interface-to-Implementation resolved edge.
  - **gRPC RPC Bindings:** Client Stub Invocation (`client.GetStatus(req)`) &rarr; Protobuf Contract &rarr; Service Implementation.
  - **Distributed Caching & Locks (Redis):** Cache Check (`redis.get(key)`) &rarr; Cache Miss Branch &rarr; Distributed Lock (`SET NX EX`) &rarr; Database query &rarr; Cache write (`redis.set(key, val, ttl)`).
  - **Event Streaming (Kafka / RabbitMQ):** Event Producer (`producer.send(topic, key, payload)`) &rarr; Kafka Topic &rarr; Consumer Group Subscription (`@KafkaListener`, `eachMessage`) &rarr; Worker Consumer Handler.
  - **Outbox Pattern:** Transactional database write to `outbox_events` table &rarr; Debezium CDC / Polling Relay &rarr; Kafka Topic &rarr; Consumer.

### 1.4 Cycle Detection & Strongly Connected Components (SCC)
- Execute cycle detection algorithms (e.g., Tarjan's or Kosaraju's SCC) on the directed import graph.
- Flag circular dependencies:
  - Immediate Cycles: File A imports File B, and File B imports File A ($A \leftrightarrow B$).
  - Transitive Cycles: $A \rightarrow B \rightarrow C \rightarrow A$.
- Highlight cycles as prime candidates for architectural refactoring during modernization.

---

## 2. Standard Graph Query Protocols

Use these conceptual query patterns when extracting structural insights:

### Query 1: Feature Slice Isolation Query
- **Goal:** Extract every file, method, and entity participating in a specific feature.
- **Input:** Entry point symbol (e.g. `OrderController.Create` or `OrderConsumer.onMessage`) and depth limit (or boundary interfaces).
- **Output:** Exact list of source files, line ranges, event topics, cache keys, and database models belonging to the feature slice.

### Query 2: Blast Radius Analysis
- **Goal:** Determine all modules affected if a specific file, event schema, or interface is modified.
- **Traversal:** Compute the transitive closure of incoming edges (reverse BFS/DFS starting from the target file or event schema).
- **Output:** Set of affected files categorized by depth (Depth 1: Direct consumers/subscribers, Depth 2+: Transitive consumers).

### Query 3: Execution Path Tracing (Sync & Async)
- **Goal:** Determine whether and how an API route or event trigger reaches a sensitive sink (e.g. database write, Redis lock, Kafka event emission, external payment call).
- **Traversal:** Directed path search (Dijkstra or BFS) from `Route(endpoint)` or `Consumer(topic)` to `Sink(operation)`.
- **Output:** Ordered list of function calls, cache checks, and message dispatches connecting ingress to egress.

---

## 3. Graph Output & Tabular Formatting

When reporting graph insights in documentation, present findings in clean, structured tables:

### Feature Execution Trace Table
| Step | Function / Component | File & Line Range | Invocation Type | Purpose in Flow |
|---|---|---|---|---|
| 1 | `OrderController.Create` | `src/controllers/OrderController.ts#L35` | HTTP POST Route | Ingress payload & idempotency key check |
| 2 | `RedisCache.get` | `src/cache/orderCache.ts#L22` | Distributed Cache | Cache-aside check for duplicate submission |
| 3 | `RedisLock.acquire` | `src/locks/redisLock.ts#L30` | Distributed Lock | Mutual exclusion on order modification |
| 4 | `OrderService.process` | `src/services/OrderService.ts#L45` | Method Call | Domain invariant evaluation & DB transaction |
| 5 | `OrderProducer.publish`| `src/events/orderProducer.ts#L50` | Kafka Event Publish| Emits `OrderCreatedEvent` to `orders.events.v1` |
| 6 | `BillingConsumer.handle`| `src/workers/billingConsumer.ts#L30` | Kafka Consumer ACK | Asynchronously processes payment against Stripe |

---

## 4. Verification Checklist
- [ ] Feature seed entry points are verified and include both GET and POST routes.
- [ ] Traversal reaches terminal data stores without broken or missing intermediary layers.
- [ ] External boundaries are decoupled into interface ports (`IUserStore`, `ISmsSender`).
- [ ] Circular dependencies within the feature slice are identified and documented.
