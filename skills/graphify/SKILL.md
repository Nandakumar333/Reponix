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
  - Trace execution paths from public ingress points down to terminal data sinks:
    $$\text{Ingress Route Handler} \longrightarrow \text{Controller} \longrightarrow \text{Domain Service} \longrightarrow \text{Repository} \longrightarrow \text{Database Client}$$
- **Handling Dynamic & Indirect Invocations:**
  - Explicit function calls (`foo()`) &rarr; Direct edge.
  - Dependency Injection (DI) bindings (`@Inject(OrderService)`, `builder.Services.AddScoped<IUserStore, UserStore>()`) &rarr; Interface-to-Implementation resolved edge.
  - Event publishing (`eventBus.emit('event', data)`) &rarr; Asynchronous decoupled edge. Map to matching subscribers/listeners.

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
- **Input:** Entry point symbol (e.g. `AccountController.Login`) and depth limit (or boundary interfaces).
- **Output:** Exact list of source files, line ranges, and database models belonging to the feature slice.

### Query 2: Blast Radius Analysis
- **Goal:** Determine all modules affected if a specific file or interface is modified.
- **Traversal:** Compute the transitive closure of incoming edges (reverse BFS/DFS starting from the target file).
- **Output:** Set of affected files categorized by depth (Depth 1: Direct consumers, Depth 2+: Transitive consumers).

### Query 3: Execution Path Tracing
- **Goal:** Determine whether and how an API route reaches a sensitive sink (e.g. database write, password verification, external payment call).
- **Traversal:** Directed path search (Dijkstra or BFS) from `Route(endpoint)` to `Sink(operation)`.
- **Output:** Ordered list of function calls and file locations connecting ingress to egress.

---

## 3. Graph Output & Tabular Formatting

When reporting graph insights in documentation, present findings in clean, structured tables:

### Feature Execution Trace Table
| Step | Function / Method | File & Line Range | Invocation Type | Purpose in Flow |
|---|---|---|---|---|
| 1 | `AccountController.Login` | `src/Controllers/AccountController.cs#L68` | HTTP POST Route | Ingress payload validation |
| 2 | `SignInManager.PasswordSignInAsync`| `src/Services/SignInManager.cs#L35` | Method Call | Orchestrates user lookup and check |
| 3 | `PasswordHasher.VerifyHashedPassword`| `src/Security/PasswordHasher.cs#L45` | Cryptographic Call | PBKDF2 hash verification |
| 4 | `UserStore.FindByNameAsync` | `src/Stores/UserStore.cs#L22` | Database Query | Fetch user record from database |

---

## 4. Verification Checklist
- [ ] Feature seed entry points are verified and include both GET and POST routes.
- [ ] Traversal reaches terminal data stores without broken or missing intermediary layers.
- [ ] External boundaries are decoupled into interface ports (`IUserStore`, `ISmsSender`).
- [ ] Circular dependencies within the feature slice are identified and documented.
