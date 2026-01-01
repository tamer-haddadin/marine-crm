import OpenAI from "openai";
import { z } from "zod";
import {
  BUSINESS_TYPES,
  CURRENCIES,
  MARINE_PRODUCT_TYPES,
  QUOTATION_STATUSES,
} from "@shared/schema";

// the newest OpenAI model is "gpt-4o" which was released May 13, 2024. do not change this unless explicitly requested by the user
const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

export async function generateEmailDraft(order: {
  brokerName: string;
  insuredName: string;
  statuses: string[];
  orderDate: Date;
  notes?: string | null;
}): Promise<string> {
  const prompt = `Generate a professional follow-up email for a Marine Underwriting order with the following details:
- Broker: ${order.brokerName}
- Insured Name: ${order.insuredName}
- Current Statuses: ${order.statuses.join(", ")}
- Order Date: ${order.orderDate}
- Additional Notes: ${order.notes || "None"}

The email should be polite and professional, specifically addressing marine insurance requirements and requesting updates on pending items. If KYC is pending, emphasize its importance for compliance. If COI is issued, request confirmation of receipt.

Format the response as a JSON object with a single 'email' field containing the draft email text.`;

  const response = await openai.chat.completions.create({
    model: "gpt-4o",
    messages: [{ role: "user", content: prompt }],
    response_format: { type: "json_object" },
  });

  const content = response.choices[0].message.content;
  if (!content) {
    throw new Error("Failed to generate email draft");
  }

  const result = JSON.parse(content);
  return result.email;
}

export async function generateStatusSummary(orders: Array<{
  brokerName: string;
  insuredName: string;
  statuses: string[];
  orderDate: Date;
}>): Promise<string> {
  const prompt = `Generate a concise summary of the following Marine Underwriting orders:
${orders.map(order => `
- Broker: ${order.brokerName}
- Insured: ${order.insuredName}
- Status: ${order.statuses.join(", ")}
- Date: ${order.orderDate}`).join('\n')}

Group the orders by status and highlight any that require immediate attention (e.g., long-pending KYC). Format the response as a JSON object with a single 'summary' field containing the summary text.`;

  const response = await openai.chat.completions.create({
    model: "gpt-4o",
    messages: [{ role: "user", content: prompt }],
    response_format: { type: "json_object" },
  });

  const content = response.choices[0].message.content;
  if (!content) {
    throw new Error("Failed to generate summary");
  }

  const result = JSON.parse(content);
  return result.summary;
}

export async function analyzeQuotations(
  quotations: Array<{
    brokerName: string;
    insuredName: string;
    marineProductType: string;
    estimatedPremium: number;
    currency: string;
    quotationDate: Date;
    status: string;
    declineReason?: string | null;
    notes?: string | null;
  }>,
  orders: Array<{
    brokerName: string;
    insuredName: string;
    marineProductType: string;
    premium: number;
    currency: string;
    orderDate: Date;
    businessType: string;
    statuses: string[];
  }>,
  dateRange?: { startDate?: Date; endDate?: Date },
  customInstructions?: string
): Promise<string> {
  // Log the data being analyzed for debugging
  console.log(`Analyzing ${quotations.length} quotations and ${orders.length} orders`);
  console.log('Date range:', dateRange?.startDate?.toISOString(), 'to', dateRange?.endDate?.toISOString());
  
  // Calculate quotation statistics based ONLY on the provided filtered data
  const openQuotations = quotations.filter(q => q.status === "Open").length;
  const confirmedQuotations = quotations.filter(q => q.status === "Confirmed").length;
  const declinedQuotations = quotations.filter(q => q.status === "Decline").length;
  const totalQuotations = quotations.length;
  const totalExcludingDeclined = totalQuotations - declinedQuotations;
  const conversionRate = totalExcludingDeclined > 0
    ? (confirmedQuotations / totalExcludingDeclined) * 100
    : 0;

  // Calculate order statistics based ONLY on the provided filtered data
  const newBusinessOrders = orders.filter(o => o.businessType === "New Business");
  const renewalOrders = orders.filter(o => o.businessType === "Renewal");
  const newBusinessPremium = newBusinessOrders.reduce((sum, order) => sum + order.premium, 0);
  const renewalPremium = renewalOrders.reduce((sum, order) => sum + order.premium, 0);
  const totalPremium = newBusinessPremium + renewalPremium;
  
  // Determine primary currency (most common currency in the dataset)
  const currencyCount = new Map<string, number>();
  [...quotations, ...orders].forEach(item => {
    const currency = item.currency;
    currencyCount.set(currency, (currencyCount.get(currency) || 0) + 1);
  });
  const primaryCurrency = Array.from(currencyCount.entries()).sort((a, b) => b[1] - a[1])[0]?.[0] || 'AED';
  
  // Product type analysis
  const productTypesMap = new Map<string, { count: number, premium: number }>();
  quotations.forEach(q => {
    const type = q.marineProductType;
    const current = productTypesMap.get(type) || { count: 0, premium: 0 };
    productTypesMap.set(type, {
      count: current.count + 1,
      premium: current.premium + q.estimatedPremium
    });
  });
  
  // Format product type stats
  const productTypeStats = Array.from(productTypesMap.entries()).map(([type, stats]) => 
    `${type}: ${stats.count} quotations, Estimated Premium: ${stats.premium.toFixed(2)} ${primaryCurrency}`
  ).join('\n');

  // Generate date range string for the prompt
  const dateRangeText = dateRange?.startDate && dateRange?.endDate 
    ? `for the period ${dateRange.startDate.toLocaleDateString()} to ${dateRange.endDate.toLocaleDateString()}`
    : 'for all time';

  // Build the analysis instructions
  const baseInstructions = `You are a professional Marine Insurance analyst. Analyze ONLY the following data ${dateRangeText} and provide detailed insights in clear, professional language without using any markdown formatting or special characters:

IMPORTANT - Use EXACTLY these statistics in your analysis - do not modify, recalculate, or invent any numbers. The data provided is ALREADY filtered for the requested date range:

1. Quotation Statistics:
- Total Open Quotations: ${openQuotations}
- Total Confirmed Quotations: ${confirmedQuotations}
- Total Declined Quotations: ${declinedQuotations}
- Total Quotations in Period: ${totalQuotations}
- Active Quotations (excluding declined): ${totalExcludingDeclined}
- Conversion Rate: ${conversionRate.toFixed(2)}%

2. Business Performance:
- New Business Orders: ${newBusinessOrders.length}
- Renewal Orders: ${renewalOrders.length}
- New Business Premium: ${newBusinessPremium.toFixed(2)} ${primaryCurrency}
- Renewal Premium: ${renewalPremium.toFixed(2)} ${primaryCurrency}
- Total Premium: ${totalPremium.toFixed(2)} ${primaryCurrency}
- Primary Currency: ${primaryCurrency}

3. Product Type Performance:
${productTypeStats}`;

  const defaultAnalysisPoints = `Then analyze:
1. Quotation performance and conversion trends
2. New vs Renewal business comparison
3. Premium distribution between new and renewal business
4. Key marine product types and their performance
5. Recommendations for business growth`;

  const customAnalysisPoints = customInstructions 
    ? `CUSTOM ANALYSIS INSTRUCTIONS: ${customInstructions}

Please focus your analysis according to these specific instructions while still using the data provided above.`
    : defaultAnalysisPoints;

  const prompt = `${baseInstructions}

${customAnalysisPoints}

Your analysis should be based SOLELY on the actual numbers provided above, not on general industry knowledge or assumptions.

Format the response as a JSON object with a single 'analysis' field containing the analysis text.`;

  const response = await openai.chat.completions.create({
    model: "gpt-4o",
    messages: [{ role: "user", content: prompt }],
    response_format: { type: "json_object" },
  });

  const content = response.choices[0].message.content;
  if (!content) {
    throw new Error("Failed to generate analysis");
  }

  const result = JSON.parse(content);
  return result.analysis;
}

const orderExtractionSchema = z.object({
  brokerName: z.string().optional().nullable(),
  insuredName: z.string().optional().nullable(),
  marineProductType: z.string().optional().nullable(),
  businessType: z.string().optional().nullable(),
  premium: z.union([z.number(), z.string()]).optional().nullable(),
  currency: z.string().optional().nullable(),
  orderDate: z.string().optional().nullable(),
  notes: z.string().optional().nullable(),
  vesselName: z.string().optional().nullable(),
  requiresPreConditionSurvey: z
    .union([z.boolean(), z.string()])
    .optional()
    .nullable(),
});

export type ExtractedOrderDetails = {
  brokerName: string | null;
  insuredName: string;
  marineProductType: (typeof MARINE_PRODUCT_TYPES)[number];
  businessType: (typeof BUSINESS_TYPES)[number];
  premium: number;
  currency: (typeof CURRENCIES)[number];
  orderDateISO: string;
  notes: string | null;
  vesselName: string | null;
  requiresPreConditionSurvey: boolean;
};

const quotationExtractionSchema = z.object({
  brokerName: z.string().optional().nullable(),
  insuredName: z.string().optional().nullable(),
  marineProductType: z.string().optional().nullable(),
  estimatedPremium: z.union([z.number(), z.string()]).optional().nullable(),
  currency: z.string().optional().nullable(),
  quotationDate: z.string().optional().nullable(),
  status: z.string().optional().nullable(),
  declineReason: z.string().optional().nullable(),
  notes: z.string().optional().nullable(),
  vesselName: z.string().optional().nullable(),
  requiresPreConditionSurvey: z
    .union([z.boolean(), z.string()])
    .optional()
    .nullable(),
});

export type ExtractedQuotationDetails = {
  brokerName: string | null;
  insuredName: string;
  marineProductType: (typeof MARINE_PRODUCT_TYPES)[number];
  estimatedPremium: number;
  currency: (typeof CURRENCIES)[number];
  quotationDateISO: string;
  status: (typeof QUOTATION_STATUSES)[number];
  declineReason: string | null;
  notes: string | null;
  vesselName: string | null;
  requiresPreConditionSurvey: boolean;
};

const MAX_QUOTATION_TEXT_LENGTH = 15000;

const productAliases: Record<string, (typeof MARINE_PRODUCT_TYPES)[number]> = {
  "pleasure boat": "Pleasure Boats",
  "pleasure boats": "Pleasure Boats",
  jetski: "Jetski",
  "jet ski": "Jetski",
  "marine cargo": "Marine Cargo Single Shipment",
  "cargo single": "Marine Cargo Single Shipment",
  "open cover": "Marine Open Cover",
  "haulier liability": "Haulier Liability/FFL",
  "haulier liability/ffl": "Haulier Liability/FFL",
  "goods in transit": "Goods in Transit",
  "marine liability": "Marine Liability",
  "p&i": "P&I",
  "p & i": "P&I",
};

const businessAliases: Record<string, (typeof BUSINESS_TYPES)[number]> = {
  new: "New Business",
  "new business": "New Business",
  renewal: "Renewal",
};

const currencyAliases: Record<string, (typeof CURRENCIES)[number]> = {
  aed: "AED",
  usd: "USD",
  eur: "EUR",
  dhs: "AED",
  dirham: "AED",
};

const quotationStatusAliases: Record<string, (typeof QUOTATION_STATUSES)[number]> = {
  open: "Open",
  opened: "Open",
  pending: "Open",
  confirmed: "Confirmed",
  confirm: "Confirmed",
  accepted: "Confirmed",
  bind: "Confirmed",
  declined: "Decline",
  decline: "Decline",
  rejected: "Decline",
};

function trimDocument(documentText: string): string {
  if (documentText.length <= MAX_QUOTATION_TEXT_LENGTH) return documentText;
  return documentText.slice(0, MAX_QUOTATION_TEXT_LENGTH);
}

function normalizeValue<T extends string>(
  value: string | null | undefined,
  list: readonly T[],
  aliases: Record<string, T>,
  defaultValue: T,
): T {
  if (!value) return defaultValue;
  const trimmed = value.trim();
  if (!trimmed) return defaultValue;
  const lower = trimmed.toLowerCase();
  const direct = list.find((option) => option.toLowerCase() === lower);
  if (direct) return direct;
  if (aliases[lower]) return aliases[lower];
  const partial = list.find((option) => lower.includes(option.toLowerCase()));
  if (partial) return partial;
  return defaultValue;
}

function normalizePremium(raw: unknown): number {
  if (typeof raw === "number" && Number.isFinite(raw)) {
    return Math.max(0, raw);
  }
  if (typeof raw === "string") {
    const cleaned = raw.replace(/[^0-9.,]/g, "").replace(/,/g, "");
    const parsed = parseFloat(cleaned);
    if (!Number.isNaN(parsed) && Number.isFinite(parsed)) {
      return Math.max(0, parsed);
    }
  }
  return 0;
}

function normalizeDate(raw: string | null | undefined): string {
  if (raw) {
    const trimmed = raw.trim();
    if (trimmed) {
      const parsed = new Date(trimmed);
      if (!Number.isNaN(parsed.getTime())) {
        return parsed.toISOString();
      }
      const parts = trimmed.match(/(\d{1,2})[\/-](\d{1,2})[\/-](\d{2,4})/);
      if (parts) {
        const day = Number(parts[1]);
        const month = Number(parts[2]) - 1;
        const year = Number(parts[3].length === 2 ? `20${parts[3]}` : parts[3]);
        const candidate = new Date(Date.UTC(year, month, day));
        if (!Number.isNaN(candidate.getTime())) {
          return candidate.toISOString();
        }
      }
    }
  }
  return new Date().toISOString();
}

function normalizeQuotationStatus(
  raw: string | null | undefined,
): (typeof QUOTATION_STATUSES)[number] {
  if (!raw) return "Open";
  const trimmed = raw.trim();
  if (!trimmed) return "Open";
  const lower = trimmed.toLowerCase();
  const direct = QUOTATION_STATUSES.find((status) => status.toLowerCase() === lower);
  if (direct) return direct;
  if (quotationStatusAliases[lower]) {
    return quotationStatusAliases[lower];
  }
  const contains = QUOTATION_STATUSES.find((status) => lower.includes(status.toLowerCase()));
  if (contains) return contains;
  return "Open";
}

function normalizeBoolean(raw: unknown): boolean {
  if (typeof raw === "boolean") return raw;
  if (typeof raw === "string") {
    const lower = raw.trim().toLowerCase();
    if (lower === "true" || lower === "yes") return true;
  }
  return false;
}

export async function extractOrderDetailsFromQuotation(
  documentText: string,
): Promise<ExtractedOrderDetails> {
  const trimmedText = documentText.length > MAX_QUOTATION_TEXT_LENGTH
    ? documentText.slice(0, MAX_QUOTATION_TEXT_LENGTH)
    : documentText;

  const prompt = `You are an underwriting operations assistant. Extract the mandatory fields for creating a marine firm order from the quotation document provided. Only use information present in the document. Choose values exactly from the allowed lists.

Return a JSON object with the following fields:
- brokerName (string or null if absent)
- insuredName (string or null)
- marineProductType (one of: ${MARINE_PRODUCT_TYPES.join(", ")})
- businessType (either "New Business" or "Renewal")
- premium (number, without currency symbol)
- currency (one of: ${CURRENCIES.join(", ")})
- orderDate (ISO 8601 date string, default to today's date if missing)
- notes (string or null)
- vesselName (string or null, required only for Pleasure Boats or Jetski)
- requiresPreConditionSurvey (boolean, true only if the document explicitly requires a survey)

If any value is missing in the document, set it to null (or false for the boolean). Do not infer the broker name; leave it null when not stated.

Document text:
"""
${trimmedText}
"""`;

  const response = await openai.chat.completions.create({
    model: "gpt-4o",
    messages: [{ role: "user", content: prompt }],
    response_format: { type: "json_object" },
    temperature: 0.2,
  });

  const content = response.choices[0].message.content;
  if (!content) {
    throw new Error("Empty extraction response from OpenAI");
  }

  let parsedJson: unknown;
  try {
    parsedJson = JSON.parse(content);
  } catch (error) {
    throw new Error("Failed to parse extraction response");
  }

  const parsed = orderExtractionSchema.safeParse(parsedJson);
  if (!parsed.success) {
    throw new Error("Extraction response failed validation");
  }

  const data = parsed.data;

  const marineProductType = normalizeValue(
    data.marineProductType,
    MARINE_PRODUCT_TYPES,
    productAliases,
    "Marine Cargo Single Shipment",
  );

  const businessType = normalizeValue(
    data.businessType,
    BUSINESS_TYPES,
    businessAliases,
    "New Business",
  );

  const currency = normalizeValue(
    data.currency,
    CURRENCIES,
    currencyAliases,
    "AED",
  );

  const premium = normalizePremium(data.premium);
  const orderDateISO = normalizeDate(data.orderDate);
  const vesselName = data.vesselName?.trim() || null;
  const notes = data.notes?.trim() || null;
  const insuredName = data.insuredName?.trim() || "";
  const brokerName = data.brokerName?.trim() || null;
  const requiresPreConditionSurvey = (() => {
    if (typeof data.requiresPreConditionSurvey === "boolean") {
      return data.requiresPreConditionSurvey;
    }
    if (typeof data.requiresPreConditionSurvey === "string") {
      const value = data.requiresPreConditionSurvey.trim().toLowerCase();
      return value === "true" || value === "yes";
    }
    return false;
  })();

  if (!insuredName) {
    throw new Error("Insured name could not be extracted");
  }

  return {
    brokerName,
    insuredName,
    marineProductType,
    businessType,
    premium,
    currency,
    orderDateISO,
    notes,
    vesselName,
    requiresPreConditionSurvey,
  };
}

export async function extractQuotationDetails(
  documentText: string,
): Promise<ExtractedQuotationDetails> {
  const trimmedText = documentText.length > MAX_QUOTATION_TEXT_LENGTH
    ? documentText.slice(0, MAX_QUOTATION_TEXT_LENGTH)
    : documentText;

  const prompt = `You are an underwriting operations assistant. Extract the mandatory fields for creating a marine quotation from the quotation document provided. Only use information present in the document. Choose values exactly from the allowed lists.

Return a JSON object with the following fields:
- brokerName (string or null if absent)
- insuredName (string or null)
- marineProductType (one of: ${MARINE_PRODUCT_TYPES.join(", ")})
- estimatedPremium (number, without currency symbol)
- currency (one of: ${CURRENCIES.join(", ")})
- quotationDate (ISO 8601 date string, default to today's date if missing)
- status (one of: ${QUOTATION_STATUSES.join(", ")}, default to "Open" when absent)
- declineReason (string or null)
- notes (string or null)
- vesselName (string or null, include yacht or jetski names for Pleasure Boats or Jetski quotes)
- requiresPreConditionSurvey (boolean, true only if the document explicitly requires a survey)

If any value is missing in the document, set it to null (or false for the boolean). Do not infer the broker name; leave it null when not stated.

Document text:
"""
${trimmedText}
"""`;

  const response = await openai.chat.completions.create({
    model: "gpt-4o",
    messages: [{ role: "user", content: prompt }],
    response_format: { type: "json_object" },
    temperature: 0.2,
  });

  const content = response.choices[0].message.content;
  if (!content) {
    throw new Error("Empty extraction response from OpenAI");
  }

  let parsedJson: unknown;
  try {
    parsedJson = JSON.parse(content);
  } catch (error) {
    throw new Error("Failed to parse extraction response");
  }

  const parsed = quotationExtractionSchema.safeParse(parsedJson);
  if (!parsed.success) {
    throw new Error("Extraction response failed validation");
  }

  const data = parsed.data;

  const marineProductType = normalizeValue(
    data.marineProductType,
    MARINE_PRODUCT_TYPES,
    productAliases,
    "Marine Cargo Single Shipment",
  );

  const currency = normalizeValue(
    data.currency,
    CURRENCIES,
    currencyAliases,
    "AED",
  );

  const premium = normalizePremium(data.estimatedPremium);
  const quotationDateISO = normalizeDate(data.quotationDate);
  const status = normalizeQuotationStatus(data.status);
  const notes = data.notes?.trim() || null;
  const declineReason = data.declineReason?.trim() || null;
  const vesselName = data.vesselName?.trim() || null;
  const brokerName = data.brokerName?.trim() || null;
  const insuredName = data.insuredName?.trim() || "";
  const requiresPreConditionSurvey = (() => {
    if (typeof data.requiresPreConditionSurvey === "boolean") {
      return data.requiresPreConditionSurvey;
    }
    if (typeof data.requiresPreConditionSurvey === "string") {
      const value = data.requiresPreConditionSurvey.trim().toLowerCase();
      return value === "true" || value === "yes";
    }
    return false;
  })();

  if (!insuredName) {
    throw new Error("Insured name could not be extracted");
  }

  return {
    brokerName,
    insuredName,
    marineProductType,
    estimatedPremium: premium,
    currency,
    quotationDateISO,
    status,
    declineReason,
    notes,
    vesselName,
    requiresPreConditionSurvey,
  };
}