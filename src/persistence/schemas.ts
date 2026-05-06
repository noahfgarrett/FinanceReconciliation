import { z } from 'zod'

export const ClientSchema = z.object({
  id: z.string(),
  name: z.string(),
  address: z.string().optional(),
  contactEmail: z.string().optional(),
  paymentTerms: z.string().default('Net 30'),
  invoiceNumberPrefix: z.string().optional(),
  invoiceNumberCounter: z.number().int().nonnegative().default(0),
  remitTo: z.string().optional(),
  footerNotes: z.string().optional(),
})
export type Client = z.infer<typeof ClientSchema>

export const EmployeeRateOverrideSchema = z.object({
  regularRate: z.number().nonnegative().optional(),
  otRate: z.number().nonnegative().optional(),
  dtRate: z.number().nonnegative().optional(),
})
export type EmployeeRateOverride = z.infer<typeof EmployeeRateOverrideSchema>

export const ProjectConfigSchema = z.object({
  projectKey: z.string(),
  displayName: z.string(),
  clientId: z.string().optional(),
  poNumber: z.string().optional(),
  allocationAliases: z.array(z.string()).default([]),
  otThresholdHrs: z.number().min(1).max(168),
  includeDoubleTime: z.boolean().default(false),
  dtThresholdHrs: z.number().min(1).max(168).optional(),
  defaultRegularRate: z.number().nonnegative(),
  otRateOverride: z.number().nonnegative().optional(),
  dtRateOverride: z.number().nonnegative().optional(),
  employeeRateOverrides: z.record(z.string(), EmployeeRateOverrideSchema).default({}),
})
export type ProjectConfig = z.infer<typeof ProjectConfigSchema>

export const FlagSchema = z.object({
  severity: z.enum(['info', 'warn', 'error']),
  code: z.enum([
    'unmatched-pdf',
    'missing-pdf',
    'project-not-configured',
    'excel-pdf-hours-mismatch',
    'high-ot-anomaly',
    'pdf-entry-missing-approval',
    'allocation-not-mapped',
    'parse-failure',
  ]),
  message: z.string(),
  context: z.record(z.unknown()).optional(),
})
export type RowFlag = z.infer<typeof FlagSchema>

export const SourceLocationSchema = z.object({
  pageIndex: z.number().int().min(1), // 1-based page number
  x: z.number(), // PDF point coordinate (origin: bottom-left)
  y: z.number(),
  width: z.number().nonnegative(),
  height: z.number().nonnegative(),
})
export type SourceLocation = z.infer<typeof SourceLocationSchema>

export const WeeklyBillingSchema = z.object({
  employeeCode: z.string(),
  projectKey: z.string(),
  weekStart: z.string(),
  hours: z.number(),
  regularHrs: z.number(),
  otHrs: z.number(),
  dtHrs: z.number(),
  regularDollars: z.number(),
  otDollars: z.number(),
  dtDollars: z.number(),
  flags: z.array(FlagSchema).default([]),
  notes: z.string().optional(),
  reviewed: z.boolean().default(false),
  confidence: z.number().min(0).max(1).default(1),
  confidenceReasons: z.array(z.string()).default([]),
  sources: z.array(SourceLocationSchema).default([]),
})
export type WeeklyBilling = z.infer<typeof WeeklyBillingSchema>

export const AuditEventSchema = z.object({
  ts: z.string(),
  action: z.enum([
    'snapshot-created',
    'snapshot-locked',
    'snapshot-unlocked',
    'project-config-edited',
    'employee-rate-overridden',
    'invoice-generated',
    'flag-resolved',
    'manual-edit',
  ]),
  detail: z.string(),
  before: z.unknown().optional(),
  after: z.unknown().optional(),
})
export type AuditEvent = z.infer<typeof AuditEventSchema>

export const EmployeeSchema = z.object({
  code: z.string(),
  firstName: z.string(),
  lastName: z.string(),
  wwid: z.string().optional(),
})
export type Employee = z.infer<typeof EmployeeSchema>

export const ExcelRowSchema = z.object({
  employeeCode: z.string(),
  laborAllocationDetails: z.string(),
  projectName: z.string(),
  regularHours: z.number(),
  overtimeHours: z.number(),
  doubleTimeHours: z.number(),
  dateUpdated: z.string(),
})
export type ExcelRow = z.infer<typeof ExcelRowSchema>

export const PdfTimesheetEntrySchema = z.object({
  date: z.string(),
  payCode: z.string(),
  allocation: z.string(),
  hoursTotal: z.number(),
  weekStart: z.string(),
  confidence: z.number().min(0).max(1).default(1),
  confidenceReasons: z.array(z.string()).default([]),
  source: SourceLocationSchema.optional(),
})
export type PdfTimesheetEntry = z.infer<typeof PdfTimesheetEntrySchema>

export const ParsedPdfSchema = z.object({
  employeeCode: z.string(),
  employeeName: z.string(),
  payPeriodStart: z.string(),
  payPeriodEnd: z.string(),
  entries: z.array(PdfTimesheetEntrySchema),
  weeklyTotals: z.record(z.string(), z.number()),
  rawText: z.string(),
  pageCount: z.number().int().nonnegative().default(0),
})
export type ParsedPdf = z.infer<typeof ParsedPdfSchema>

/**
 * Runtime augmentation for ParsedPdf carrying the original PDF bytes.
 * Stored on IDB via structured clone (no schema validation), and stripped
 * from JSON exports because bytes are too heavy.
 */
export interface ParsedPdfWithBytes extends ParsedPdf {
  pdfBytes?: ArrayBuffer
}

export const SnapshotSchema = z.object({
  id: z.string(),
  name: z.string(),
  periodLabel: z.string(),
  createdAt: z.string(),
  lastModifiedAt: z.string(),
  locked: z.boolean().default(false),
  isDraft: z.boolean().default(false),
  employees: z.array(EmployeeSchema),
  excelRows: z.array(ExcelRowSchema),
  parsedPdfs: z.array(ParsedPdfSchema),
  projectConfigsAtSave: z.record(z.string(), ProjectConfigSchema),
  clientsAtSave: z.record(z.string(), ClientSchema),
  weeklyBilling: z.array(WeeklyBillingSchema),
  warnings: z.array(FlagSchema),
  auditLog: z.array(AuditEventSchema),
})
export type Snapshot = z.infer<typeof SnapshotSchema>

export const ExportBundleSchema = z.object({
  schemaVersion: z.literal(1),
  exportedAt: z.string(),
  appVersion: z.string(),
  scope: z.enum(['all', 'settings', 'history']),
  clients: z.record(z.string(), ClientSchema).optional(),
  projectConfigs: z.record(z.string(), ProjectConfigSchema).optional(),
  snapshots: z.array(SnapshotSchema).optional(),
})
export type ExportBundle = z.infer<typeof ExportBundleSchema>
