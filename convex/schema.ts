import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

export default defineSchema({
  settings: defineTable({
    userId: v.string(), // tokenIdentifier from Clerk
    ownerName: v.string(),
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
    type: v.union(
      v.literal("personal_expense"),
      v.literal("business_expense"),
      v.literal("business_expense_personal_pay"),
      v.literal("personal_expense_business_pay"),
      v.literal("transfer_to_personal"),
      v.literal("transfer_to_business"),
      v.literal("dividend_payment")
    ),
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
});
