import { z } from "zod";

export const GraphNodeTypeSchema = z.enum([
  "file",
  "module",
  "class",
  "function",
  "interface",
  "variable",
]);

export type GraphNodeType = z.infer<typeof GraphNodeTypeSchema>;

export const GraphRelationshipTypeSchema = z.enum([
  "imports",
  "calls",
  "implements",
  "extends",
  "depends_on",
  "defines",
]);

export type GraphRelationshipType = z.infer<typeof GraphRelationshipTypeSchema>;

export const GraphNodeLocationSchema = z.object({
  startLine: z.number().int().positive().optional(),
  endLine: z.number().int().positive().optional(),
});

export type GraphNodeLocation = z.infer<typeof GraphNodeLocationSchema>;

export const GraphNodeMetadataSchema = z.object({
  language: z.string().optional(),
  isExported: z.boolean().optional(),
  visibility: z.enum(["public", "private", "protected"]).optional(),
  signature: z.string().optional(),
  docstring: z.string().optional(),
  parameters: z.array(z.string()).optional(),
  returnType: z.string().optional(),
}).catchall(z.unknown());

export type GraphNodeMetadata = z.infer<typeof GraphNodeMetadataSchema>;

export const GraphNodeSchema = z.object({
  id: z.string().min(1, "Node id is required"),
  name: z.string().min(1, "Node name is required"),
  type: GraphNodeTypeSchema,
  path: z.string().min(1, "Node file path is required"),
  location: GraphNodeLocationSchema.optional(),
  metadata: GraphNodeMetadataSchema.optional(),
});

export type GraphNode = z.infer<typeof GraphNodeSchema>;

export const GraphRelationshipMetadataSchema = z.object({
  weight: z.number().optional(),
  callLine: z.number().optional(),
}).catchall(z.unknown());

export type GraphRelationshipMetadata = z.infer<typeof GraphRelationshipMetadataSchema>;

export const GraphRelationshipSchema = z.object({
  id: z.string().min(1, "Relationship id is required"),
  sourceId: z.string().min(1, "Source id is required"),
  targetId: z.string().min(1, "Target id is required"),
  type: GraphRelationshipTypeSchema,
  metadata: GraphRelationshipMetadataSchema.optional(),
});

export type GraphRelationship = z.infer<typeof GraphRelationshipSchema>;

export const NormalizedGraphStatsSchema = z.object({
  nodeCount: z.number().int().nonnegative().default(0),
  relationshipCount: z.number().int().nonnegative().default(0),
  nodeTypes: z.record(z.string(), z.number().int().nonnegative()).default({}),
  relationshipTypes: z.record(z.string(), z.number().int().nonnegative()).default({}),
});

export type NormalizedGraphStats = z.infer<typeof NormalizedGraphStatsSchema>;

export const NormalizedGraphSchema = z.object({
  version: z.string().default("1.0"),
  repository: z.string().default("unknown"),
  generatedAt: z.string().default(() => new Date().toISOString()),
  stats: NormalizedGraphStatsSchema.default({}),
  nodes: z.array(GraphNodeSchema).default([]),
  relationships: z.array(GraphRelationshipSchema).default([]),
});

export type NormalizedGraph = z.infer<typeof NormalizedGraphSchema>;

export const GraphIndexDataSchema = z.object({
  nodesById: z.record(z.string(), GraphNodeSchema).default({}),
  nodesByName: z.record(z.string(), z.array(z.string())).default({}),
  nodesByPath: z.record(z.string(), z.array(z.string())).default({}),
  nodesByType: z.record(GraphNodeTypeSchema, z.array(z.string())).default({
    file: [],
    module: [],
    class: [],
    function: [],
    interface: [],
    variable: [],
  }),
  outgoingEdges: z.record(z.string(), z.array(GraphRelationshipSchema)).default({}),
  incomingEdges: z.record(z.string(), z.array(GraphRelationshipSchema)).default({}),
});

export type GraphIndexData = z.infer<typeof GraphIndexDataSchema>;
