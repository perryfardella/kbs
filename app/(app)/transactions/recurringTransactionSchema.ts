import { z } from "zod";

export const recurringTransactionSchema = z
  .object({
    kind: z.enum(["income", "expense", "transfer"]),
    realm: z.enum(["personal", "business", "rental"]).optional(),
    account: z.enum(["personal", "business"]).optional(),
    from: z.enum(["personal", "business"]).optional(),
    to: z.enum(["personal", "business"]).optional(),
    purpose: z.literal("dividend").optional(),
    amount: z
      .string()
      .min(1, "Enter a valid amount")
      .refine((v) => parseFloat(v) > 0, { message: "Enter a valid amount" }),
    description: z.string().min(1, "Description is required"),
    categoryId: z.string().optional(),
    propertyId: z.string().optional(),
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
    if (data.kind === "transfer") {
      if (!data.from || !data.to) {
        ctx.addIssue({ code: z.ZodIssueCode.custom, message: "Select a direction", path: ["from"] });
      }
    } else if (!data.realm) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: "Select who this is for", path: ["realm"] });
    } else {
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
