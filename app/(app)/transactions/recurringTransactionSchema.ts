import { z } from "zod";

type CategoryRealm = "personal" | "business" | null;

const EXPENSE_TYPE_REALMS: Record<string, CategoryRealm> = {
  personal_expense: "personal",
  business_expense: "business",
  business_expense_personal_pay: "business",
  personal_expense_business_pay: "personal",
  transfer_to_personal: null,
  transfer_to_business: null,
  dividend_payment: null,
};

export const recurringTransactionSchema = z
  .object({
    type: z.enum([
      "personal_expense",
      "business_expense",
      "business_expense_personal_pay",
      "personal_expense_business_pay",
      "transfer_to_personal",
      "transfer_to_business",
      "dividend_payment",
    ]),
    amount: z
      .string()
      .min(1, "Enter a valid amount")
      .refine((v) => parseFloat(v) > 0, { message: "Enter a valid amount" }),
    description: z.string().min(1, "Description is required"),
    categoryId: z.string().optional(),
    notes: z.string().optional(),
    frequency: z.enum(["weekly", "biweekly", "monthly", "yearly"]),
    // weekly/biweekly: 0–6 (day of week); monthly: 1–31
    anchorDay: z.number().optional(),
    // yearly: "MM-DD"
    anchorDate: z.string().optional(),
    startDate: z.string().min(1, "Start date is required"),
    endDate: z.string().optional(),
  })
  .superRefine((data, ctx) => {
    const realm = EXPENSE_TYPE_REALMS[data.type];
    if (realm !== null && !data.categoryId) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Select a category",
        path: ["categoryId"],
      });
    }
    if ((data.frequency === "weekly") && data.anchorDay === undefined) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Select a day of the week",
        path: ["anchorDay"],
      });
    }
    if (data.frequency === "monthly" && (data.anchorDay === undefined || data.anchorDay < 1 || data.anchorDay > 31)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Enter a day between 1 and 31",
        path: ["anchorDay"],
      });
    }
    if (data.frequency === "yearly" && !data.anchorDate) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Select a month and day",
        path: ["anchorDate"],
      });
    }
  });

export type RecurringTransactionFormValues = z.infer<typeof recurringTransactionSchema>;
