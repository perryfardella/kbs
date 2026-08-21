import { z } from "zod";

export const transactionSchema = z
  .object({
    kind: z.enum(["income", "expense", "transfer"]),
    realm: z.enum(["personal", "business", "rental"]).optional(),
    account: z.enum(["personal", "business"]).optional(),
    from: z.enum(["personal", "business"]).optional(),
    to: z.enum(["personal", "business"]).optional(),
    purpose: z.literal("dividend").optional(),
    paidDate: z.string().optional(),
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
    if (data.kind === "transfer") {
      if (!data.from || !data.to) {
        ctx.addIssue({ code: z.ZodIssueCode.custom, message: "Select a direction", path: ["from"] });
      }
      return;
    }

    if (!data.realm) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: "Select who this is for", path: ["realm"] });
      return;
    }
    // Rental income is never categorized ("rent received" is self-explanatory);
    // every other income/expense realm requires one.
    const needsCategory = !(data.kind === "income" && data.realm === "rental");
    if (needsCategory && !data.categoryId) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Select a category",
        path: ["categoryId"],
      });
    }
    if (data.realm === "rental" && !data.propertyId) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Select a property",
        path: ["propertyId"],
      });
    }
  })
  .refine((data) => !data.paidDate || data.paidDate >= data.date, {
    message: "Paid date can't be before the declared date",
    path: ["paidDate"],
  });

export type TransactionFormValues = z.infer<typeof transactionSchema>;
