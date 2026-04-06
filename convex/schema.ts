import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

const transactionTypeValidator = v.union(
  v.literal("personal_expense"),
  v.literal("business_expense"),
  v.literal("business_expense_personal_pay"),
  v.literal("personal_expense_business_pay"),
  v.literal("transfer_to_personal"),
  v.literal("transfer_to_business"),
  v.literal("dividend_payment")
);

export default defineSchema({
  settings: defineTable({
    userId: v.string(), // tokenIdentifier from Clerk
    companyName: v.string(),
    fiscalYearEnd: v.string(), // "MM-DD" format
    currency: v.string(), // "CAD"
    loanAlertThreshold: v.optional(v.number()),
  }).index("by_user", ["userId"]),

  categories: defineTable({
    userId: v.string(), // tokenIdentifier from Clerk
    name: v.string(),
    realm: v.union(
      v.literal("personal"),
      v.literal("business"),
      v.literal("both")
    ),
    isDefault: v.boolean(),
    isArchived: v.boolean(),
  })
    .index("by_user", ["userId"])
    .index("by_user_and_isArchived", ["userId", "isArchived"]),

  transactions: defineTable({
    userId: v.string(), // tokenIdentifier from Clerk
    date: v.string(), // "YYYY-MM-DD"
    amount: v.number(),
    description: v.string(),
    notes: v.optional(v.string()),
    type: transactionTypeValidator,
    categoryId: v.optional(v.id("categories")),
    receiptStorageId: v.optional(v.id("_storage")),
    shareholderLoanDelta: v.number(),
  })
    .index("by_user", ["userId"])
    .index("by_user_date", ["userId", "date"])
    .index("by_user_type", ["userId", "type"])
    .index("by_user_type_date", ["userId", "type", "date"])
    .searchIndex("search_description", {
      searchField: "description",
      filterFields: ["userId"],
    }),

  recurringTransactions: defineTable({
    userId: v.string(), // tokenIdentifier from Clerk
    description: v.string(),
    amount: v.number(),
    type: transactionTypeValidator,
    categoryId: v.optional(v.id("categories")),
    notes: v.optional(v.string()),
    frequency: v.union(
      v.literal("weekly"),
      v.literal("biweekly"),
      v.literal("monthly"),
      v.literal("yearly")
    ),
    // weekly/biweekly: 0–6 (day of week, 0=Sun); monthly: 1–31 (day of month)
    anchorDay: v.optional(v.number()),
    // yearly only: "MM-DD"
    anchorDate: v.optional(v.string()),
    startDate: v.string(), // "YYYY-MM-DD" — first eligible occurrence
    endDate: v.optional(v.string()), // "YYYY-MM-DD" — stop after this date
    isActive: v.boolean(),
  })
    .index("by_user", ["userId"])
    .index("by_user_active", ["userId", "isActive"]),

  recurringOccurrences: defineTable({
    userId: v.string(), // tokenIdentifier from Clerk
    recurringTransactionId: v.id("recurringTransactions"),
    scheduledDate: v.string(), // "YYYY-MM-DD" — which occurrence this covers
    appliedTransactionId: v.id("transactions"),
    appliedAt: v.number(), // Date.now()
  })
    .index("by_user", ["userId"])
    .index("by_recurring", ["recurringTransactionId"])
    .index("by_recurring_date", ["recurringTransactionId", "scheduledDate"]),
});
