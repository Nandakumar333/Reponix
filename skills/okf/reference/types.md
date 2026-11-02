# Reponix Concept Types Reference

This document catalogs every supported concept type in the Reponix OKF bundle, its path pattern, owning agent, required headings, and example structure.

---

## 1. Overview Concept

### `Repository`
- **Owning Agent:** `reponix-orchestrator`
- **Path Pattern:** `overview.md`
- **Required Headings:** `# Executive Summary`, `# Subsystems`
- **Description:** High-level architectural synthesis and subsystem directory of the repository.

---

## 2. Inventory Subtree (`inventory/`)

### `Technology Stack`
- **Owning Agent:** `repo-analyst`
- **Path Pattern:** `inventory/stack.md`
- **Required Headings:** `# Stack Matrix`, `# Runtimes & Frameworks`
- **Description:** Languages, frameworks, runtimes, and execution environments detected across the repository.

### `Dependency`
- **Owning Agent:** `repo-analyst`
- **Path Pattern:** `inventory/dependencies/<pkg>.md`
- **Required Headings:** `# Overview`, `# Usage in Repository`
- **Description:** Third-party package, library, or framework used by the system.

### `Build Tool`
- **Owning Agent:** `repo-analyst`
- **Path Pattern:** `inventory/build/<tool>.md`
- **Required Headings:** `# Build Configuration`, `# Artifacts`
- **Description:** Build automation, bundler, compiler, or package manager.

### `Configuration`
- **Owning Agent:** `repo-analyst`
- **Path Pattern:** `inventory/configs/<file>.md`
- **Required Headings:** `# Configuration Schema`, `# Environment Variables`
- **Description:** Application settings, environment file, or dynamic configuration source.

---

## 3. Architecture Subtree (`architecture/`)

### `Architecture View`
- **Owning Agent:** `arch-mapper`
- **Path Pattern:** `architecture/system-context.md`
- **Required Headings:** `# System Topology`, `# Mermaid Diagrams`
- **Description:** Macro-level component diagrams, system context diagrams, or deployment topology.

### `Component`
- **Owning Agent:** `arch-mapper`
- **Path Pattern:** `architecture/components/<name>.md`
- **Required Headings:** `# Overview`, `# Interfaces & Dependencies`
- **Description:** Logical service, module, or layer boundary within the architecture.

### `Data Flow`
- **Owning Agent:** `arch-mapper`
- **Path Pattern:** `architecture/flows/<name>.md`
- **Required Headings:** `# Sequence Lifecycle`, `# Flow Diagram`
- **Description:** End-to-end synchronous or asynchronous data path across multiple components.

### `Architecture Decision`
- **Owning Agent:** `arch-mapper`
- **Path Pattern:** `architecture/decisions/<id>.md`
- **Required Headings:** `# Context`, `# Decision`, `# Consequences`
- **Description:** Architectural Decision Record (ADR) capturing significant technical choices.

---

## 4. Contracts Subtree (`contracts/`)

### `API Endpoint`
- **Owning Agent:** `code-inspector`
- **Path Pattern:** `contracts/apis/<method>-<path>.md`
- **Required Headings:** `# Schema`, `# Behavior`
- **Description:** REST endpoint, GraphQL query/mutation, or gRPC RPC method.

### `Database Table`
- **Owning Agent:** `code-inspector`
- **Path Pattern:** `contracts/schemas/<table>.md`
- **Required Headings:** `# Schema`, `# Indexes & Constraints`
- **Description:** Relational table, document collection, or key-value namespace.

### `Domain Entity`
- **Owning Agent:** `code-inspector`
- **Path Pattern:** `contracts/entities/<name>.md`
- **Required Headings:** `# Invariants`, `# Fields`
- **Description:** Core domain model, value object, or state entity.

### `Business Rule`
- **Owning Agent:** `code-inspector`
- **Path Pattern:** `contracts/rules/<name>.md`
- **Required Headings:** `# Rule Statement`, `# Implementation Logic`
- **Description:** Business policy, calculation invariant, or authorization rule.

### `Event`
- **Owning Agent:** `code-inspector`
- **Path Pattern:** `contracts/events/<name>.md`
- **Required Headings:** `# Payload Schema`, `# Producers & Consumers`
- **Description:** Message broker topic, event stream, or asynchronous notification schema.

---

## 5. Reconstruction Subtree (`reconstruction/`)

### `Reconstruction Blueprint`
- **Owning Agent:** `modernizer`
- **Path Pattern:** `reconstruction/blueprint.md`
- **Required Headings:** `# Architecture Target`, `# Invariants`
- **Description:** Target-neutral modernization plan and architectural invariants.

### `Migration Phase`
- **Owning Agent:** `modernizer`
- **Path Pattern:** `reconstruction/phases/<nn>-<name>.md`
- **Required Headings:** `# Scope`, `# Migration Steps`, `# Exit Criteria`
- **Description:** Sequential refactoring phase or migration milestone.

### `Target Specification`
- **Owning Agent:** `modernizer`
- **Path Pattern:** `reconstruction/specs/<component>.md`
- **Required Headings:** `# Target Contract`, `# Implementation Guide`
- **Description:** Target-neutral implementation specification for a modern replacement component.

---

## 6. Validation Subtree (`validation/`)

### `Validation Report`
- **Owning Agent:** `validator`
- **Path Pattern:** `validation/report.md`
- **Required Headings:** `# Audit Summary`, `# Verification Metrics`
- **Description:** Empirical evidence audit and claim verification report.

### `Gap`
- **Owning Agent:** `validator`
- **Path Pattern:** `validation/gaps/<id>.md`
- **Required Headings:** `# Defect Description`, `# Remediations`
- **Description:** Missing source citation, dangling dependency, or unhandled branch.
