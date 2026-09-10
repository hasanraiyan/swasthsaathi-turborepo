import { z } from 'zod';

import {
  byIdSchema,
  capability,
  dateOnlySchema,
  idSchema,
  notesSchema,
  paginationSchema,
  recordMetaShape,
} from './common';

export const DOCUMENT_KIND = [
  'lab_report',
  'prescription',
  'scan',
  'discharge_summary',
  'insurance',
  'other',
] as const;
export type DocumentKind = (typeof DOCUMENT_KIND)[number];

/**
 * A medical document the user has kept: a lab report, a prescription, a scan.
 *
 * The record is metadata only. The file itself lives in object storage and is
 * referenced by `storageKey`; download URLs are minted per request and never
 * stored, so a leaked row can't be turned into a leaked report.
 */
export const documentSchema = z.object({
  ...recordMetaShape,
  title: z.string().min(1).max(200),
  kind: z.enum(DOCUMENT_KIND),
  documentDate: dateOnlySchema.nullable(),
  doctorId: idSchema.nullable(),
  conditionId: idSchema.nullable(),
  appointmentId: idSchema.nullable(),
  storageKey: z.string().max(500).nullable(),
  mimeType: z.string().max(120).nullable(),
  sizeBytes: z.number().int().min(0).nullable(),
  notes: notesSchema.nullable(),
});
export type HealthDocument = z.infer<typeof documentSchema>;

export const createDocumentSchema = z.object({
  title: z.string().min(1).max(200).describe('e.g. "CBC panel, Apollo Diagnostics"'),
  kind: z.enum(DOCUMENT_KIND).default('other'),
  documentDate: dateOnlySchema.nullish().describe('Date printed on the document'),
  doctorId: idSchema.nullish(),
  conditionId: idSchema.nullish(),
  appointmentId: idSchema.nullish(),
  storageKey: z.string().max(500).nullish().describe('Key of the uploaded file in object storage'),
  mimeType: z.string().max(120).nullish(),
  sizeBytes: z.number().int().min(0).nullish(),
  notes: notesSchema.nullish(),
});
export type CreateDocumentInput = z.infer<typeof createDocumentSchema>;

export const updateDocumentSchema = createDocumentSchema.partial().extend(byIdSchema.shape);
export type UpdateDocumentInput = z.infer<typeof updateDocumentSchema>;

export const listDocumentsSchema = paginationSchema.extend({
  kind: z.enum(DOCUMENT_KIND).optional(),
  doctorId: idSchema.optional(),
  conditionId: idSchema.optional(),
  search: z.string().max(200).optional(),
});
export type ListDocumentsInput = z.infer<typeof listDocumentsSchema>;

export const documentCapabilities = {
  list: capability({
    name: 'documents.list',
    description:
      'List the medical documents the user has stored -- lab reports, prescriptions, scans -- filtered by kind, doctor, condition or a search term.',
    kind: 'read',
    input: listDocumentsSchema,
  }),
  get: capability({
    name: 'documents.get',
    description: 'Read one document record by id.',
    kind: 'read',
    input: byIdSchema,
  }),
  create: capability({
    name: 'documents.create',
    description:
      'Register a medical document. The file is uploaded separately; this records what it is and what it relates to.',
    kind: 'write',
    input: createDocumentSchema,
  }),
  update: capability({
    name: 'documents.update',
    description: 'Update a document record, for example to link it to a condition.',
    kind: 'write',
    input: updateDocumentSchema,
  }),
  remove: capability({
    name: 'documents.delete',
    description: 'Delete a document record and its stored file.',
    kind: 'write',
    input: byIdSchema,
  }),
} as const;
