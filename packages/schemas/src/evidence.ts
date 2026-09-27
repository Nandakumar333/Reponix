import { z } from "zod";

export const EvidenceTypeSchema = z.enum([
  "EXTRACTED",
  "DERIVED",
  "INFERRED",
  "VALIDATED",
]);

export type EvidenceType = z.infer<typeof EvidenceTypeSchema>;

export const EvidenceRecordSchema = z.object({
  id: z.string().min(1, "Evidence ID is required"),
  type: EvidenceTypeSchema,
  source: z.string().min(1, "Source file or origin is required"),
  location: z.string().optional(),
  description: z.string().min(1, "Description is required"),
  confidence: z.number().min(0).max(1),
  metadata: z.record(z.unknown()).optional(),
});

export type EvidenceRecord = z.infer<typeof EvidenceRecordSchema>;
