import { z } from "zod";

type CategoryRealm = "personal" | "business" | "rental" | null;

const EXPENSE_TYPE_REALMS: Record<string, CategoryRealm> = {
  personal_expense: "personal",
  business_expense: "business",
  business_expense_personal_pay: "business",
  personal_expense_business_pay: "personal",
  transfer_to_personal: null,
  transfer_to_business: null,
  dividend_payment: null,
  rental_income: null,
  rental_expense: "rental",
};

const RENTAL_TYPES = ["rental_income", "rental_expense"];

export const transactionSchema = z
  .object({
    type: z.enum([
      "personal_expense",
      "business_expense",
      "business_expense_personal_pay",
      "personal_expense_business_pay",
      "transfer_to_personal",
      "transfer_to_business",
      "dividend_payment",
      "rental_income",
      "rental_expense",
    ]),
    amount: z
      .string()
      .min(1, "Enter a valid amount")
      .refine((v) => parseFloat(v) > 0, { message: "Enter a valid amount" }),
    date: z.string().min(1, "Date is required"),
    description: z.string().min(1, "Description is required"),
    categoryId: z.string().optional(),
    propertyId: z.string().optional(),
    notes: z.string().optional(),
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
    if (RENTAL_TYPES.includes(data.type) && !data.propertyId) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Select a property",
        path: ["propertyId"],
      });
    }
  });

export type TransactionFormValues = z.infer<typeof transactionSchema>;
