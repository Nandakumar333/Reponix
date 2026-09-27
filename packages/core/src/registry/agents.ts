import type { AgentDefinition } from "@reponix/schemas";

export const spyOrchestratorAgent: AgentDefinition = {
  id: "spy-orchestrator",
  name: "SPY Orchestrator",
  description: "Master coordinator managing repository archaeology, state transitions, and reconstruction specs.",
  role: "Archaeological Master Coordinator",
  mission: "Coordinate execution of semantic agents, validate structured handoffs, enforce evidence grounding, and drive reconstruction.",
  responsibilities: [
    "Manage sequential execution of archaeology agents",
    "Validate structured handoff contracts from each subagent",
    "Track archaeological progress and update status registry",
    "Halt execution on critical contradictions or confidence deficits",
    "Orchestrate final reconstruction spec generation",
  ],
  inputs: [".reponix/config.yaml", ".reponix/manifest.json", ".reponix/graph/"],
  outputs: [".reponix/status.json", ".reponix/audit.log"],
  skills: ["graphify", "repository-analysis"],
  workflow: [
    "Verify project configuration and structural graph status",
    "Initialize status.json with detected scope",
    "Trigger structural and inventory discovery",
    "Orchestrate semantic understanding agents",
    "Execute validation and contradiction checks",
    "Trigger reconstruction spec compilation",
  ],
  optional: false,
  dependencies: [],
};

export const repositoryAnalystAgent: AgentDefinition = {
  id: "repository-analyst",
  name: "Repository Analyst",
  description: "Analyzes directory trees, package manifests, build configs, and CI/CD pipelines.",
  role: "Repository Cartographer",
  mission: "Catalog repository structure, runtime environments, package dependencies, and build pipelines.",
  responsibilities: [
    "Parse package manifests (package.json, pom.xml, go.mod, Cargo.toml, requirements.txt, *.csproj)",
    "Catalog directory hierarchy and functional module zones",
    "Identify build targets, package managers, and container setups",
    "Output repository summary documentation and machine-readable inventory",
  ],
  inputs: ["Repository root file tree", "Build manifests and package files"],
  outputs: [
    ".reponix/docs/repository.md",
    ".reponix/docs/directories.md",
    ".reponix/semantic/technology-stack.json",
    ".reponix/semantic/repository-inventory.json",
  ],
  skills: ["repository-analysis"],
  workflow: [
    "Discover package manifests across repository",
    "Parse dependencies, runtimes, and build scripts",
    "Categorize source directories into functional layers",
    "Synthesize technology profile and inventory records",
  ],
  optional: false,
  dependencies: [],
};

export const architectureAgent: AgentDefinition = {
  id: "architecture-agent",
  name: "Architecture Agent",
  description: "Infers system architecture patterns, component boundaries, and generates Mermaid diagrams.",
  role: "System Architecture Mapper",
  mission: "Map architectural style, layers, boundaries, and produce visual Mermaid system topologies.",
  responsibilities: [
    "Identify architectural patterns (Monolith, Microservices, Clean Architecture, Hexagonal)",
    "Map system layers and inter-component communication flow",
    "Render Mermaid architecture diagrams",
    "Highlight layering violations and circular dependencies",
  ],
  inputs: [".reponix/graph/normalized/", ".reponix/semantic/repository-inventory.json"],
  outputs: [
    ".reponix/docs/architecture.md",
    ".reponix/docs/architecture.mmd",
    ".reponix/semantic/architecture.json",
  ],
  skills: ["repository-analysis"],
  workflow: [
    "Ingest structural graph and inventory models",
    "Group components into logical domains and boundaries",
    "Trace communication flows and interface bindings",
    "Generate Mermaid architecture diagrams and invariants",
  ],
  optional: false,
  dependencies: ["repository-analyst"],
};

export const codeAgent: AgentDefinition = {
  id: "code-agent",
  name: "Code Agent",
  description: "Indexes classes, interfaces, entry points, and domain algorithms.",
  role: "Symbol & Code Archaeologist",
  mission: "Index source code units, public interfaces, types, and isolate domain algorithms from boilerplate.",
  responsibilities: [
    "Catalog classes, interfaces, traits, and functions",
    "Index parameter signatures, return types, and access modifiers",
    "Identify core domain algorithms and business calculation logic",
    "Flag unreferenced symbols and dead code",
  ],
  inputs: ["Source code files", ".reponix/graph/"],
  outputs: [".reponix/docs/code.md", ".reponix/semantic/code-inventory.json"],
  skills: ["repository-analysis"],
  workflow: [
    "Scan source files for exported types, classes, and methods",
    "Extract method contracts and visibility modifiers",
    "Distinguish core domain algorithms from glue code",
    "Compile code symbol inventory with file/line anchors",
  ],
  optional: false,
  dependencies: ["repository-analyst"],
};

export const apiAgent: AgentDefinition = {
  id: "api-agent",
  name: "API Agent",
  description: "Extracts and documents REST routes, GraphQL schemas, gRPC definitions, and messaging protocols.",
  role: "Interface Contract Archaeologist",
  mission: "Extract and document all external interfaces and communication contracts.",
  responsibilities: [
    "Locate route handlers, controllers, and schema definitions",
    "Extract HTTP methods, paths, parameters, payloads, and status codes",
    "Document message queue producers and consumers",
    "Map authorization scopes and security policies per route",
  ],
  inputs: ["Route files, controllers, schema definitions", ".reponix/graph/"],
  outputs: [".reponix/docs/api/README.md", ".reponix/semantic/apis.json"],
  skills: ["repository-analysis"],
  workflow: [
    "Scan entry points and route registration tables",
    "Extract request/response contracts and status codes",
    "Document queue events and async messaging contracts",
    "Output unified API catalog",
  ],
  optional: false,
  dependencies: ["code-agent"],
};

export const databaseAgent: AgentDefinition = {
  id: "database-agent",
  name: "Database Agent",
  description: "Reverse engineers data storage, entity schemas, migrations, and ORM models.",
  role: "Data Layer Archaeologist",
  mission: "Map database tables, columns, relationships, migrations, and ORM persistence models.",
  responsibilities: [
    "Parse ORM entities and schema declarations",
    "Trace migration files and schema evolution history",
    "Map primary/foreign keys, indices, and constraints",
    "Correlate ORM models to domain entities",
  ],
  inputs: ["Entity models, migrations, persistence configs"],
  outputs: [".reponix/docs/database/README.md", ".reponix/semantic/database.json"],
  skills: ["repository-analysis"],
  workflow: [
    "Discover ORM definitions and migration scripts",
    "Extract relational schemas, columns, constraints, and keys",
    "Link database models to domain code entities",
    "Synthesize entity-relationship documentation",
  ],
  optional: false,
  dependencies: ["code-agent"],
};

export const featureAgent: AgentDefinition = {
  id: "feature-agent",
  name: "Feature Agent",
  description: "Connects business features to code entry points, services, and databases.",
  role: "Feature Cartographer",
  mission: "Map high-level capabilities to concrete technical code paths and test verification points.",
  responsibilities: [
    "Identify business capabilities delivered by the repository",
    "Trace features end-to-end (Route -> Service -> Database -> Tests)",
    "Document user authorization rules per feature",
    "Establish code-to-capability traceability matrices",
  ],
  inputs: [".reponix/semantic/apis.json", ".reponix/semantic/database.json", ".reponix/semantic/code-inventory.json"],
  outputs: [".reponix/docs/features/README.md", ".reponix/semantic/features.json"],
  skills: ["repository-analysis"],
  workflow: [
    "Enumerate user features from routes and controllers",
    "Trace sequence of function calls and mutations per feature",
    "Link feature actions to concrete code evidence IDs",
    "Output feature traceability matrix",
  ],
  optional: false,
  dependencies: ["api-agent", "database-agent"],
};

export const workflowAgent: AgentDefinition = {
  id: "workflow-agent",
  name: "Workflow Agent",
  description: "Traces execution paths, asynchronous workflows, and failure/recovery flows.",
  role: "Workflow & Transaction Analyst",
  mission: "Document happy paths, validation failures, retries, compensation, and background jobs.",
  responsibilities: [
    "Trace state changes and transaction lifecycles",
    "Document validation failure points and compensation rollbacks",
    "Map scheduled jobs and asynchronous queues",
    "Render workflow sequence diagrams in Mermaid",
  ],
  inputs: [".reponix/semantic/features.json", "Source code files"],
  outputs: [".reponix/docs/workflows/README.md", ".reponix/semantic/workflows.json"],
  skills: ["repository-analysis"],
  workflow: [
    "Select critical business transactions from feature maps",
    "Trace state transitions and transaction boundaries",
    "Map error handling, retry policies, and rollback paths",
    "Render sequence diagrams and compile workflow specs",
  ],
  optional: false,
  dependencies: ["feature-agent"],
};

export const businessRuleAgent: AgentDefinition = {
  id: "business-rule-agent",
  name: "Business Rule Agent",
  description: "Extracts explicit validation thresholds, calculations, and domain constraints.",
  role: "Domain Invariant Extractor",
  mission: "Extract and document domain validation rules, thresholds, calculations, and invariants.",
  responsibilities: [
    "Extract input validation limits, ranges, and formats",
    "Formulate pricing, tax, fee, or scoring algorithms",
    "Document state machine transition restrictions",
    "Express all rules in target-neutral logic with line evidence",
  ],
  inputs: [".reponix/semantic/code-inventory.json", "Source files"],
  outputs: [".reponix/docs/business-rules/README.md", ".reponix/semantic/business-rules.json"],
  skills: ["repository-analysis"],
  workflow: [
    "Inspect validation rules, guards, and domain methods",
    "Extract formulas, thresholds, and conditions",
    "Formulate rules with condition, outcome, and evidence anchors",
    "Compile business rule catalog",
  ],
  optional: false,
  dependencies: ["code-agent"],
};

export const securityAgent: AgentDefinition = {
  id: "security-agent",
  name: "Security Agent",
  description: "Maps auth, encryption, access controls, and redacts sensitive credentials.",
  role: "Security & Redaction Analyst",
  mission: "Document security architecture and enforce redaction of secrets from all artifacts.",
  responsibilities: [
    "Map authentication mechanisms (JWT, OAuth2, Session, API Keys)",
    "Document authorization models (RBAC, ABAC, route policies)",
    "Inventory sensitive data flows and encryption safeguards",
    "Redact secrets and credentials from all Reponix generated files",
  ],
  inputs: ["Auth middleware, security configs, routes"],
  outputs: [".reponix/docs/security/README.md", ".reponix/semantic/security.json"],
  skills: ["repository-analysis"],
  workflow: [
    "Locate security and auth middleware",
    "Map permissions, scopes, and protected resources",
    "Verify credential handling and secret isolation",
    "Redact sensitive data and output security specifications",
  ],
  optional: false,
  dependencies: ["api-agent"],
};

export const testingAgent: AgentDefinition = {
  id: "testing-agent",
  name: "Testing Agent",
  description: "Analyzes test suites to determine verified vs unverified behaviors.",
  role: "Test Suite Archaeologist",
  mission: "Inventory test suites and correlate assertions to business features and rules.",
  responsibilities: [
    "Inventory unit, integration, and end-to-end tests",
    "Classify test fixtures, mocks, and environment setups",
    "Correlate test assertions with features and business rules",
    "Highlight untested business logic and coverage gaps",
  ],
  inputs: ["Test files, runner configs", ".reponix/semantic/features.json"],
  outputs: [".reponix/docs/testing/README.md", ".reponix/semantic/tests.json"],
  skills: ["repository-analysis"],
  workflow: [
    "Scan test directories and runner configurations",
    "Parse test cases, suites, and assertion targets",
    "Map assertions to features and business rules",
    "Output test coverage and behavior verification matrix",
  ],
  optional: false,
  dependencies: ["feature-agent"],
};

export const reconstructionAgent: AgentDefinition = {
  id: "reconstruction-agent",
  name: "Reconstruction Agent",
  description: "Synthesizes semantic intelligence into target-neutral reconstruction blueprints.",
  role: "Software Reconstruction Architect",
  mission: "Generate clean, language-independent implementation blueprints for external AI coding harnesses.",
  responsibilities: [
    "Compile master System Specification (system-spec.md)",
    "Generate target-neutral component contracts and entity models",
    "Formulate API contracts and sequence blueprints",
    "Provide target language/framework adaptation guidelines",
  ],
  inputs: [".reponix/semantic/", ".reponix/evidence/", ".reponix/graph/"],
  outputs: [
    ".reponix/reconstruction/system-spec.md",
    ".reponix/reconstruction/components/",
    ".reponix/reconstruction/data-model/",
    ".reponix/reconstruction/api-contracts/",
  ],
  skills: ["reconstruction"],
  workflow: [
    "Ingest all semantic, structural, and behavioral intelligence",
    "Abstract framework quirks into target-neutral contracts",
    "Generate modular specification blueprints",
    "Verify complete functional coverage against source baseline",
  ],
  optional: false,
  dependencies: ["business-rule-agent", "workflow-agent"],
};

export const validatorAgent: AgentDefinition = {
  id: "validator-agent",
  name: "Validator Agent",
  description: "Rigorous cross-checking of semantic conclusions, evidence, and reconstruction specs.",
  role: "Evidence & Reconstruction Auditor",
  mission: "Audit semantic claims, detect contradictions, verify evidence anchors, and flag reconstruction gaps.",
  responsibilities: [
    "Verify that all assertions link to valid code evidence IDs",
    "Detect contradictions across semantic and security findings",
    "Identify missing evidence or ungrounded inferences",
    "Calculate archaeological confidence score (0.0 to 1.0)",
  ],
  inputs: [".reponix/evidence/", ".reponix/semantic/", ".reponix/reconstruction/"],
  outputs: [
    ".reponix/validation/report.md",
    ".reponix/validation/contradictions.json",
    ".reponix/validation/missing-evidence.json",
    ".reponix/validation/reconstruction-gaps.json",
  ],
  skills: ["repository-analysis"],
  workflow: [
    "Audit evidence IDs against repository source anchors",
    "Cross-reference semantic facts for contradictions",
    "Compare reconstruction specs against feature inventory",
    "Compile audit report and confidence score",
  ],
  optional: false,
  dependencies: [],
};

export const allAgents: AgentDefinition[] = [
  spyOrchestratorAgent,
  repositoryAnalystAgent,
  architectureAgent,
  codeAgent,
  apiAgent,
  databaseAgent,
  featureAgent,
  workflowAgent,
  businessRuleAgent,
  securityAgent,
  testingAgent,
  reconstructionAgent,
  validatorAgent,
];
