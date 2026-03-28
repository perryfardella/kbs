import { v } from "convex/values";
import { action, internalAction } from "./_generated/server";
import { internal } from "./_generated/api";

/** Converts a DD/MM/YYYY string to YYYY-MM-DD. */
function parseReceiptDate(raw: string): string | undefined {
  const match = raw.trim().match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
  if (!match) return undefined;
  const [, d, m, y] = match;
  return `${y}-${m}-${d}`;
}

type ScanResult = {
  amount?: string;
  date?: string;
  description?: string;
  type?: "personal_expense" | "business_expense";
  categoryId?: string;
  notes?: string;
};

const categoryValidator = v.object({
  id: v.string(),
  name: v.string(),
  realm: v.union(v.literal("personal"), v.literal("business"), v.literal("both")),
});

const scanArgs = {
  imageBase64: v.string(),
  imageType: v.string(),
  categories: v.array(categoryValidator),
};

export const scanReceipt = internalAction({
  args: scanArgs,
  handler: async (_ctx, args): Promise<ScanResult> => {
    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (!apiKey) throw new Error("ANTHROPIC_API_KEY not configured");

    const personalCats = args.categories.filter(
      (c) => c.realm === "personal" || c.realm === "both"
    );
    const businessCats = args.categories.filter(
      (c) => c.realm === "business" || c.realm === "both"
    );

    const categorySection = [
      "PERSONAL CATEGORIES:",
      ...personalCats.map((c) => `  - id: "${c.id}", name: "${c.name}"`),
      "",
      "BUSINESS CATEGORIES:",
      ...businessCats.map((c) => `  - id: "${c.id}", name: "${c.name}"`),
    ].join("\n");

    const prompt = `You are a receipt scanner for a personal finance app used by a Canadian physician. The app tracks expenses between personal accounts and a medical corporation to manage a shareholder loan balance.

Analyze this receipt image and extract transaction data.

DATE FORMAT — This app is used in Canada. Dates are never in American MM/DD/YYYY format. Always return dates as DD/MM/YYYY. For example, if a receipt shows "03/04/2025" that is the 3rd of April and you must return "03/04/2025".

TRANSACTION TYPE — only infer one of these two based on what the receipt shows:
- "personal_expense": A personal purchase (groceries, dining, clothing, personal travel, personal subscriptions, etc.)
- "business_expense": A purchase for the medical corporation (medical supplies, professional development/CME, professional fees, office supplies, business software, business travel, business meals, etc.)
Do NOT return any other transaction type — the other types depend on which bank account was used to pay, which cannot be determined from a receipt alone.

${categorySection}

Return a JSON object with only the fields you are confident about (omit any field you are unsure of):
{
  "amount": "42.50",                          // total amount paid, decimal string, no currency symbol
  "date": "03/04/2025",                       // always DD/MM/YYYY
  "description": "Tim Hortons — double-double and muffin", // merchant name plus a short note on what was purchased, enough to identify the transaction at a glance
  "type": "personal_expense",                 // "personal_expense" or "business_expense" only
  "categoryId": "...",                        // the exact id string from the category list above that best fits
  "notes": "2x coffee, 1 muffin"             // brief summary of line items if visible on the receipt
}

If the image is not a receipt or no fields can be confidently extracted, return: {}

Respond with valid JSON only. No explanation, no markdown, no code fences.`;

    const response = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01",
        "content-type": "application/json",
      },
      body: JSON.stringify({
        model: "claude-haiku-4-5-20251001",
        max_tokens: 512,
        messages: [
          {
            role: "user",
            content: [
              {
                type: "image",
                source: {
                  type: "base64",
                  media_type: args.imageType,
                  data: args.imageBase64,
                },
              },
              {
                type: "text",
                text: prompt,
              },
            ],
          },
        ],
      }),
    });

    if (!response.ok) {
      throw new Error(`Anthropic API error: ${response.status}`);
    }

    const data = await response.json() as { content?: Array<{ text?: string }> };
    const raw = data.content?.[0]?.text ?? "{}";
    console.log("[receiptScanner] raw response:", raw);

    // Strip markdown code fences — Haiku sometimes wraps JSON despite instructions
    const text = raw.replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/, "").trim();

    try {
      const parsed = JSON.parse(text) as Record<string, unknown>;
      const result: ScanResult = {};

      if (
        typeof parsed.amount === "string" &&
        /^\d+(\.\d{1,2})?$/.test(parsed.amount)
      ) {
        result.amount = parsed.amount;
      }
      if (typeof parsed.date === "string") {
        const normalized = parseReceiptDate(parsed.date);
        if (normalized) result.date = normalized;
      }
      if (typeof parsed.description === "string" && parsed.description.length > 0) {
        result.description = parsed.description;
      }
      if (
        parsed.type === "personal_expense" ||
        parsed.type === "business_expense"
      ) {
        result.type = parsed.type;
      }
      if (
        typeof parsed.categoryId === "string" &&
        args.categories.some((c) => c.id === parsed.categoryId)
      ) {
        result.categoryId = parsed.categoryId;
      }
      if (typeof parsed.notes === "string" && parsed.notes.length > 0) {
        result.notes = parsed.notes;
      }

      return result;
    } catch {
      return {};
    }
  },
});

// Public wrapper — authenticates the caller before delegating to the internal action.
export const scanReceiptPublic = action({
  args: scanArgs,
  handler: async (ctx, args): Promise<ScanResult> => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Unauthenticated");
    return await ctx.runAction(internal.receiptScanner.scanReceipt, args);
  },
});
