import { z } from "zod";

export const saleWorkPersonSchema = z.enum(["co-le", "co-thy"]);

export const saleWorkSnapshotSchema = z.object({
  conversations: z.number().int().nonnegative(),
  sentMessages: z.number().int().nonnegative(),
  receivedMessages: z.number().int().nonnegative(),
  incomingCalls: z.number().int().nonnegative(),
  outgoingCalls: z.number().int().nonnegative(),
  missedCalls: z.number().int().nonnegative(),
  callDurationSeconds: z.number().int().nonnegative(),
  syncedAt: z.iso.datetime({ offset: true }),
}).strict();

export const saleWorkSyncSchema = z.object({
  person: saleWorkPersonSchema,
  date: z.iso.date(),
  snapshot: saleWorkSnapshotSchema,
}).strict();

export type SaleWorkSyncInput = z.infer<typeof saleWorkSyncSchema>;
export type SaleWorkSnapshot = z.infer<typeof saleWorkSnapshotSchema>;
