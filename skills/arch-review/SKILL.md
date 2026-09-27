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

---

## 2. Mermaid Diagramming Standards & Syntax Guardrails

### 2.1 Feature Component & Boundary Diagrams (`graph TD`)
- Isolate the feature's active participants inside explicit subgraphs:
  ```mermaid
  graph TD
      subgraph Ingress ["API & UI Ingress"]
          LoginRoute["POST /account/login"]
          MfaRoute["POST /account/mfa/verify"]
      end

      subgraph DomainCore ["Authentication Domain Core"]
          AuthService["Auth & Sign-In Service"]
          LockoutEngine["Lockout & Throttling Policy"]
          CryptoEngine["Password & TOTP Cryptography"]
      end

      subgraph PersistencePorts ["Storage & External Ports"]
          UserRepo[("User & Credential Store")]
          SmsGateway["Twilio SMS Gateway"]
      end

      LoginRoute --> AuthService
      MfaRoute --> AuthService
      AuthService --> LockoutEngine
      AuthService --> CryptoEngine
      AuthService --> UserRepo
      AuthService -. "MFA Challenge" .-> SmsGateway
  ```

### 2.2 Multi-Branch Sequence Diagrams (`sequenceDiagram`)
- Model the complete lifecycle of the feature including branch conditions (`alt` / `else`):
  ```mermaid
  sequenceDiagram
      autonumber
      actor User
      participant Route as Login Controller
      participant Svc as Auth Service
      participant Store as User Store
      participant Crypto as Password Hasher

      User->>Route: POST /login (username, password)
      Route->>Svc: authenticate(username, password)
      Svc->>Store: findUser(username)
      Store-->>Svc: UserEntity

      alt User Account is Locked Out
          Svc-->>Route: Result.LockedOut(until: timestamp)
          Route-->>User: 423 Locked
      else Invalid Password
          Svc->>Crypto: verify(password, hash)
          Crypto-->>Svc: False
          Svc->>Store: incrementFailedCount(userId)
          Svc-->>Route: Result.InvalidCredentials
          Route-->>User: 401 Unauthorized
      else Valid Credentials & MFA Required
          Svc->>Crypto: verify(password, hash)
          Crypto-->>Svc: True
          Svc-->>Route: Result.RequiresMfa(challengeToken)
          Route-->>User: 200 OK (Requires MFA)
      else Valid Credentials & Success
          Svc-->>Route: Result.Success(claims)
          Route-->>User: 200 OK (Set-Cookie: session)
      end
  ```

---

## 3. Architecture Review Checklist
- [ ] Feature boundaries are strictly encapsulated with zero leaky controller-to-database bypasses.
- [ ] External dependencies are abstracted behind clean boundary interfaces (Ports).
- [ ] Sequence diagram captures happy path, authentication failures, lockouts, and 2FA branches.
- [ ] All Mermaid labels with parentheses or special characters are properly quoted.
