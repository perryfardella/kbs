import { internalMutation } from "./_generated/server";
import { v } from "convex/values";
import { Id } from "./_generated/dataModel";

type TransactionType =
  | "personal_expense"
  | "business_expense"
  | "business_expense_personal_pay"
  | "personal_expense_business_pay"
  | "transfer_to_personal"
  | "transfer_to_business"
  | "dividend_payment";

function computeDelta(type: TransactionType, amount: number): number {
  switch (type) {
    case "business_expense_personal_pay":
    case "transfer_to_business":
      return amount;
    case "personal_expense_business_pay":
    case "transfer_to_personal":
    case "dividend_payment":
      return -amount;
    default:
      return 0;
  }
}

const DEFAULT_CATEGORIES: Array<{
  name: string;
  realm: "personal" | "business" | "both";
}> = [
  { name: "Medical Supplies & Equipment", realm: "business" },
  { name: "Professional Development / CME", realm: "business" },
  { name: "Insurance", realm: "business" },
  { name: "Professional Fees (accounting, legal)", realm: "business" },
  { name: "Office & Admin Supplies", realm: "business" },
  { name: "Software & Subscriptions", realm: "business" },
  { name: "Phone & Internet (business portion)", realm: "business" },
  { name: "Travel & Transportation (business)", realm: "business" },
  { name: "Meals & Entertainment (business)", realm: "business" },
  { name: "Home Office", realm: "business" },
  { name: "Marketing", realm: "business" },
  { name: "Bank Fees (business)", realm: "business" },
  { name: "Other Business", realm: "business" },
  { name: "Groceries", realm: "personal" },
  { name: "Dining & Restaurants", realm: "personal" },
  { name: "Transportation & Gas", realm: "personal" },
  { name: "Housing & Utilities", realm: "personal" },
  { name: "Health & Wellness", realm: "personal" },
  { name: "Clothing & Personal", realm: "personal" },
  { name: "Entertainment & Subscriptions", realm: "personal" },
  { name: "Travel (personal)", realm: "personal" },
  { name: "Bank Fees (personal)", realm: "personal" },
  { name: "Other Personal", realm: "personal" },
];

type SeedTransaction = {
  date: string;
  amount: number;
  description: string;
  notes?: string;
  type: TransactionType;
  categoryName: string;
};

const SEED_TRANSACTIONS: SeedTransaction[] = [
  // === personal_expense (28) ===
  { date: "2025-04-03", amount: 142.56, description: "Superstore — groceries", type: "personal_expense", categoryName: "Groceries" },
  { date: "2025-04-11", amount: 67.20, description: "Shell — gas fill-up", type: "personal_expense", categoryName: "Transportation & Gas" },
  { date: "2025-04-18", amount: 28.40, description: "Tim Hortons — lunch with friend", type: "personal_expense", categoryName: "Dining & Restaurants" },
  { date: "2025-04-25", amount: 210.00, description: "BC Hydro — electricity bill", type: "personal_expense", categoryName: "Housing & Utilities" },
  { date: "2025-05-02", amount: 118.75, description: "Superstore — groceries", type: "personal_expense", categoryName: "Groceries" },
  { date: "2025-05-09", amount: 16.99, description: "Netflix — monthly subscription", type: "personal_expense", categoryName: "Entertainment & Subscriptions" },
  { date: "2025-05-16", amount: 54.30, description: "Esso — gas fill-up", type: "personal_expense", categoryName: "Transportation & Gas" },
  { date: "2025-05-23", amount: 89.00, description: "Shoppers Drug Mart — prescriptions & toiletries", type: "personal_expense", categoryName: "Health & Wellness" },
  { date: "2025-06-05", amount: 156.40, description: "Safeway — groceries", type: "personal_expense", categoryName: "Groceries" },
  { date: "2025-06-14", amount: 220.00, description: "TELUS — home internet & phone", type: "personal_expense", categoryName: "Housing & Utilities" },
  { date: "2025-06-21", amount: 76.50, description: "The Keg — dinner with spouse", type: "personal_expense", categoryName: "Dining & Restaurants" },
  { date: "2025-07-03", amount: 135.20, description: "Costco — groceries & household", type: "personal_expense", categoryName: "Groceries" },
  { date: "2025-07-12", amount: 48.90, description: "Petro-Canada — gas fill-up", type: "personal_expense", categoryName: "Transportation & Gas" },
  { date: "2025-07-19", amount: 299.00, description: "Lululemon — athletic wear", type: "personal_expense", categoryName: "Clothing & Personal" },
  { date: "2025-08-02", amount: 112.65, description: "Superstore — groceries", type: "personal_expense", categoryName: "Groceries" },
  { date: "2025-08-15", amount: 350.00, description: "WestJet — flights to Calgary (personal)", type: "personal_expense", categoryName: "Travel (personal)" },
  { date: "2025-08-22", amount: 210.00, description: "BC Hydro — electricity bill", type: "personal_expense", categoryName: "Housing & Utilities" },
  { date: "2025-09-05", amount: 145.80, description: "Safeway — groceries", type: "personal_expense", categoryName: "Groceries" },
  { date: "2025-09-13", amount: 62.40, description: "Shell — gas fill-up", type: "personal_expense", categoryName: "Transportation & Gas" },
  { date: "2025-09-27", amount: 34.50, description: "Cineplex — movies & popcorn", type: "personal_expense", categoryName: "Entertainment & Subscriptions" },
  { date: "2025-10-04", amount: 128.90, description: "Superstore — groceries", type: "personal_expense", categoryName: "Groceries" },
  { date: "2025-10-18", amount: 18.99, description: "Spotify — family plan", type: "personal_expense", categoryName: "Entertainment & Subscriptions" },
  { date: "2025-11-07", amount: 160.00, description: "Costco — groceries & household", type: "personal_expense", categoryName: "Groceries" },
  { date: "2025-11-22", amount: 245.00, description: "H&M — winter clothing", type: "personal_expense", categoryName: "Clothing & Personal" },
  { date: "2025-12-06", amount: 142.30, description: "Superstore — groceries", type: "personal_expense", categoryName: "Groceries" },
  { date: "2025-12-20", amount: 220.00, description: "BC Hydro — electricity bill", type: "personal_expense", categoryName: "Housing & Utilities" },
  { date: "2026-01-10", amount: 138.50, description: "Safeway — groceries", type: "personal_expense", categoryName: "Groceries" },
  { date: "2026-02-14", amount: 95.00, description: "Physiotherapy — knee treatment", type: "personal_expense", categoryName: "Health & Wellness" },

  // === business_expense (22) ===
  { date: "2025-04-08", amount: 320.00, description: "Medical Supplies Direct — wound care kit", type: "business_expense", categoryName: "Medical Supplies & Equipment" },
  { date: "2025-04-15", amount: 1200.00, description: "CMPA — annual malpractice insurance", type: "business_expense", categoryName: "Insurance" },
  { date: "2025-04-22", amount: 49.00, description: "Jane App — EMR monthly subscription", type: "business_expense", categoryName: "Software & Subscriptions" },
  { date: "2025-05-05", amount: 85.00, description: "Staples — office supplies", type: "business_expense", categoryName: "Office & Admin Supplies" },
  { date: "2025-05-12", amount: 649.00, description: "CNA — annual membership dues", type: "business_expense", categoryName: "Professional Fees (accounting, legal)" },
  { date: "2025-05-28", amount: 49.00, description: "Jane App — EMR monthly subscription", type: "business_expense", categoryName: "Software & Subscriptions" },
  { date: "2025-06-10", amount: 180.00, description: "BCIT — CPR recertification course", type: "business_expense", categoryName: "Professional Development / CME" },
  { date: "2025-06-25", amount: 49.00, description: "Jane App — EMR monthly subscription", type: "business_expense", categoryName: "Software & Subscriptions" },
  { date: "2025-07-08", amount: 2200.00, description: "AANP Conference — registration & materials", type: "business_expense", categoryName: "Professional Development / CME" },
  { date: "2025-07-15", amount: 49.00, description: "Jane App — EMR monthly subscription", type: "business_expense", categoryName: "Software & Subscriptions" },
  { date: "2025-07-28", amount: 112.50, description: "Telus — business phone portion", type: "business_expense", categoryName: "Phone & Internet (business portion)" },
  { date: "2025-08-05", amount: 450.00, description: "Medical equipment — stethoscope replacement", type: "business_expense", categoryName: "Medical Supplies & Equipment" },
  { date: "2025-08-19", amount: 49.00, description: "Jane App — EMR monthly subscription", type: "business_expense", categoryName: "Software & Subscriptions" },
  { date: "2025-09-02", amount: 75.00, description: "TD Bank — business account fees", type: "business_expense", categoryName: "Bank Fees (business)" },
  { date: "2025-09-16", amount: 49.00, description: "Jane App — EMR monthly subscription", type: "business_expense", categoryName: "Software & Subscriptions" },
  { date: "2025-10-07", amount: 800.00, description: "Home office — ergonomic chair (50% business)", type: "business_expense", categoryName: "Home Office", notes: "50% business use allocation" },
  { date: "2025-10-21", amount: 49.00, description: "Jane App — EMR monthly subscription", type: "business_expense", categoryName: "Software & Subscriptions" },
  { date: "2025-11-04", amount: 112.50, description: "Telus — business phone portion", type: "business_expense", categoryName: "Phone & Internet (business portion)" },
  { date: "2025-11-18", amount: 49.00, description: "Jane App — EMR monthly subscription", type: "business_expense", categoryName: "Software & Subscriptions" },
  { date: "2025-12-09", amount: 250.00, description: "Medical Supplies Direct — gloves, syringes, PPE", type: "business_expense", categoryName: "Medical Supplies & Equipment" },
  { date: "2026-01-13", amount: 49.00, description: "Jane App — EMR monthly subscription", type: "business_expense", categoryName: "Software & Subscriptions" },
  { date: "2026-02-10", amount: 1800.00, description: "CPA — year-end bookkeeping & tax prep", type: "business_expense", categoryName: "Professional Fees (accounting, legal)", notes: "Annual accounting fees" },

  // === business_expense_personal_pay (15) — corp owes personal ===
  { date: "2025-04-05", amount: 89.50, description: "Amazon — medical reference books (personal card)", type: "business_expense_personal_pay", categoryName: "Professional Development / CME" },
  { date: "2025-04-19", amount: 156.00, description: "London Drugs — clinical supplies (personal card)", type: "business_expense_personal_pay", categoryName: "Medical Supplies & Equipment" },
  { date: "2025-05-07", amount: 62.40, description: "Staples — printer ink & paper (personal card)", type: "business_expense_personal_pay", categoryName: "Office & Admin Supplies" },
  { date: "2025-05-21", amount: 245.00, description: "Air Canada — conference travel (personal card)", type: "business_expense_personal_pay", categoryName: "Travel & Transportation (business)" },
  { date: "2025-06-03", amount: 38.90, description: "Tim Hortons — working lunch with colleague (personal card)", type: "business_expense_personal_pay", categoryName: "Meals & Entertainment (business)" },
  { date: "2025-06-17", amount: 320.00, description: "Fairmont — conference hotel (personal card)", type: "business_expense_personal_pay", categoryName: "Travel & Transportation (business)" },
  { date: "2025-07-01", amount: 110.00, description: "Zoom — annual subscription (personal card)", type: "business_expense_personal_pay", categoryName: "Software & Subscriptions" },
  { date: "2025-08-08", amount: 54.75, description: "Business meals — client dinner (personal card)", type: "business_expense_personal_pay", categoryName: "Meals & Entertainment (business)" },
  { date: "2025-09-10", amount: 198.00, description: "UBC — online CME module (personal card)", type: "business_expense_personal_pay", categoryName: "Professional Development / CME" },
  { date: "2025-10-02", amount: 76.20, description: "Staples — business stationery (personal card)", type: "business_expense_personal_pay", categoryName: "Office & Admin Supplies" },
  { date: "2025-11-01", amount: 415.00, description: "Air Canada — site visit travel (personal card)", type: "business_expense_personal_pay", categoryName: "Travel & Transportation (business)" },
  { date: "2025-12-03", amount: 48.50, description: "Business lunch — team meeting (personal card)", type: "business_expense_personal_pay", categoryName: "Meals & Entertainment (business)" },
  { date: "2026-01-07", amount: 299.00, description: "Microsoft 365 — annual business plan (personal card)", type: "business_expense_personal_pay", categoryName: "Software & Subscriptions" },
  { date: "2026-02-04", amount: 88.00, description: "Kinkos — patient handout printing (personal card)", type: "business_expense_personal_pay", categoryName: "Office & Admin Supplies" },
  { date: "2026-03-01", amount: 145.00, description: "CNPS — liability insurance top-up (personal card)", type: "business_expense_personal_pay", categoryName: "Insurance" },

  // === personal_expense_business_pay (12) — corp paid personal, corp owes less ===
  { date: "2025-04-09", amount: 210.00, description: "BC Hydro — home electricity (corp account in error)", type: "personal_expense_business_pay", categoryName: "Housing & Utilities", notes: "Paid from corp account in error — to be reconciled" },
  { date: "2025-05-14", amount: 68.00, description: "Superstore — personal groceries (corp card)", type: "personal_expense_business_pay", categoryName: "Groceries", notes: "Personal purchase on corp card" },
  { date: "2025-06-08", amount: 45.00, description: "Spotify — personal subscription (corp account)", type: "personal_expense_business_pay", categoryName: "Entertainment & Subscriptions" },
  { date: "2025-07-05", amount: 132.00, description: "TELUS — personal phone portion (corp account)", type: "personal_expense_business_pay", categoryName: "Housing & Utilities" },
  { date: "2025-08-11", amount: 89.00, description: "Personal dining — anniversary dinner (corp card)", type: "personal_expense_business_pay", categoryName: "Dining & Restaurants", notes: "Personal expense on corp card" },
  { date: "2025-09-06", amount: 210.00, description: "BC Hydro — home electricity (corp account in error)", type: "personal_expense_business_pay", categoryName: "Housing & Utilities" },
  { date: "2025-10-10", amount: 54.20, description: "Gas — personal vehicle (corp card)", type: "personal_expense_business_pay", categoryName: "Transportation & Gas" },
  { date: "2025-11-12", amount: 175.00, description: "Shoppers — personal health items (corp card)", type: "personal_expense_business_pay", categoryName: "Health & Wellness" },
  { date: "2025-12-15", amount: 210.00, description: "BC Hydro — home electricity (corp account in error)", type: "personal_expense_business_pay", categoryName: "Housing & Utilities" },
  { date: "2026-01-08", amount: 62.50, description: "Personal groceries — Safeway (corp card)", type: "personal_expense_business_pay", categoryName: "Groceries" },
  { date: "2026-02-06", amount: 38.00, description: "Netflix — personal subscription (corp account)", type: "personal_expense_business_pay", categoryName: "Entertainment & Subscriptions" },
  { date: "2026-03-05", amount: 95.00, description: "Personal physiotherapy (corp card)", type: "personal_expense_business_pay", categoryName: "Health & Wellness" },

  // === transfer_to_personal (10) — corp repays Karina ===
  { date: "2025-04-30", amount: 2500.00, description: "Corp → personal: reimbursement for Q4 expenses", type: "transfer_to_personal", categoryName: "Other Business", notes: "Shareholder loan repayment" },
  { date: "2025-05-31", amount: 1800.00, description: "Corp → personal: salary transfer", type: "transfer_to_personal", categoryName: "Other Business" },
  { date: "2025-06-30", amount: 3000.00, description: "Corp → personal: reimbursement for conference expenses", type: "transfer_to_personal", categoryName: "Other Business", notes: "Covers AANP travel and registration" },
  { date: "2025-07-31", amount: 1800.00, description: "Corp → personal: salary transfer", type: "transfer_to_personal", categoryName: "Other Business" },
  { date: "2025-08-31", amount: 1800.00, description: "Corp → personal: salary transfer", type: "transfer_to_personal", categoryName: "Other Business" },
  { date: "2025-09-30", amount: 1800.00, description: "Corp → personal: salary transfer", type: "transfer_to_personal", categoryName: "Other Business" },
  { date: "2025-10-31", amount: 2200.00, description: "Corp → personal: reimbursement batch", type: "transfer_to_personal", categoryName: "Other Business" },
  { date: "2025-11-30", amount: 1800.00, description: "Corp → personal: salary transfer", type: "transfer_to_personal", categoryName: "Other Business" },
  { date: "2026-01-31", amount: 1800.00, description: "Corp → personal: salary transfer", type: "transfer_to_personal", categoryName: "Other Business" },
  { date: "2026-02-28", amount: 1800.00, description: "Corp → personal: salary transfer", type: "transfer_to_personal", categoryName: "Other Business" },

  // === transfer_to_business (8) — Karina funds corp ===
  { date: "2025-04-01", amount: 5000.00, description: "Personal → corp: initial operating funds", type: "transfer_to_business", categoryName: "Other Business", notes: "Startup capital injection" },
  { date: "2025-05-15", amount: 1500.00, description: "Personal → corp: top-up for insurance payment", type: "transfer_to_business", categoryName: "Other Business" },
  { date: "2025-07-10", amount: 2500.00, description: "Personal → corp: conference & travel advance", type: "transfer_to_business", categoryName: "Other Business" },
  { date: "2025-09-20", amount: 1000.00, description: "Personal → corp: cover equipment purchase", type: "transfer_to_business", categoryName: "Other Business" },
  { date: "2025-11-10", amount: 2000.00, description: "Personal → corp: Q4 operating funds", type: "transfer_to_business", categoryName: "Other Business" },
  { date: "2026-01-05", amount: 3000.00, description: "Personal → corp: new fiscal year top-up", type: "transfer_to_business", categoryName: "Other Business" },
  { date: "2026-02-20", amount: 1500.00, description: "Personal → corp: cover CPA invoice", type: "transfer_to_business", categoryName: "Other Business" },
  { date: "2026-03-15", amount: 1000.00, description: "Personal → corp: year-end top-up", type: "transfer_to_business", categoryName: "Other Business" },

  // === dividend_payment (5) ===
  { date: "2025-06-30", amount: 4000.00, description: "Q1 dividend — corp to Karina", type: "dividend_payment", categoryName: "Other Business", notes: "Fiscal Q1 dividend distribution" },
  { date: "2025-09-30", amount: 4000.00, description: "Q2 dividend — corp to Karina", type: "dividend_payment", categoryName: "Other Business", notes: "Fiscal Q2 dividend distribution" },
  { date: "2025-12-31", amount: 5000.00, description: "Q3 dividend — corp to Karina", type: "dividend_payment", categoryName: "Other Business", notes: "Fiscal Q3 dividend distribution" },
  { date: "2026-02-28", amount: 3000.00, description: "Special dividend — tax planning", type: "dividend_payment", categoryName: "Other Business", notes: "Year-end tax planning distribution" },
  { date: "2026-03-31", amount: 4500.00, description: "Q4 dividend — corp to Karina", type: "dividend_payment", categoryName: "Other Business", notes: "Fiscal Q4 dividend distribution" },
];

export const seedTransactions = internalMutation({
  args: { userId: v.string() },
  handler: async (ctx, args) => {
    const { userId } = args;

    // Guard against double-seeding
    const existingTx = await ctx.db
      .query("transactions")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .take(1);
    if (existingTx.length > 0) {
      throw new Error(
        `User ${userId} already has transactions. Clear them first or use a different userId.`
      );
    }

    // Ensure categories exist; seed defaults if not
    const existingCats = await ctx.db
      .query("categories")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .collect();

    let categoryIds: Map<string, Id<"categories">>;

    if (existingCats.length === 0) {
      // Seed default categories
      categoryIds = new Map();
      for (const cat of DEFAULT_CATEGORIES) {
        const id = await ctx.db.insert("categories", {
          userId,
          name: cat.name,
          realm: cat.realm,
          isDefault: true,
          isArchived: false,
        });
        categoryIds.set(cat.name, id);
      }
    } else {
      categoryIds = new Map(existingCats.map((c) => [c.name, c._id]));
    }

    // Insert all 100 transactions
    let inserted = 0;
    for (const tx of SEED_TRANSACTIONS) {
      const categoryId = categoryIds.get(tx.categoryName);
      if (!categoryId) {
        throw new Error(`Category not found: "${tx.categoryName}"`);
      }
      const shareholderLoanDelta = computeDelta(tx.type, tx.amount);
      await ctx.db.insert("transactions", {
        userId,
        date: tx.date,
        amount: tx.amount,
        description: tx.description,
        notes: tx.notes,
        type: tx.type,
        categoryId,
        shareholderLoanDelta,
      });
      inserted++;
    }

    return { inserted, categoriesSeeded: existingCats.length === 0 };
  },
});
