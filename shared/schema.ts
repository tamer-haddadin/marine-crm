import { pgTable, text, serial, timestamp, numeric, boolean, varchar, date, integer, decimal, smallint } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";
import { InferSelectModel, InferInsertModel } from "drizzle-orm";

// App Settings table for storing application-wide configuration like active year
export const appSettings = pgTable("app_settings", {
  id: serial("id").primaryKey(),
  key: text("key").notNull().unique(),
  value: text("value").notNull(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export type AppSetting = InferSelectModel<typeof appSettings>;

// Lines of Business
export const LINES_OF_BUSINESS = [
  "Marine",
  "Property & Engineering", 
  "Liability & Financial"
] as const;

export type LineOfBusiness = typeof LINES_OF_BUSINESS[number];

export const users = pgTable("users", {
  id: serial("id").primaryKey(),
  username: text("username").notNull().unique(),
  password: text("password").notNull(),
  department: text("department").notNull(), // LOB department
});

// Marine Product Types (existing)
export const MARINE_PRODUCT_TYPES = [
  "Marine Cargo Single Shipment",
  "Marine Open Cover",
  "Haulier Liability/FFL",
  "Commercial Vessel",
  "Pleasure Boats",
  "Jetski",
  "P&I",
  "Marine Liability",
  "Goods in Transit"
] as const;

// Property & Engineering Product Types
export const PROPERTY_ENGINEERING_PRODUCT_TYPES = [
  // Engineering Products
  "CONTRACTORS ALL RISKS",
  "ERECTION ALL RISKS", 
  "Comprehensive Project (CP)",
  "Delay in Start Up (DSU) / Advanced Loss of Profit only in conjunction with CAR / EAR / CP sublimit 10% of Total Contract Value maximum USD 1,361,470",
  "Contractor's Plant and Machinery (CPM) including own damage losses of self propelled CPM's whilst in transit on the road",
  "Third Party Liability when written in conjunction with CAR / EAR / CPM / BPV only",
  "MACHINERY ALL RISKS",
  "MACHINERY BREAKDOWN",
  "LOSS OF PROFIT FOLLOWING MACHINERY BREAKDOWN",
  "BOILER AND PRESSURE VESSEL",
  "ELECTRONIC EQUIPMENT",
  "DETERIORATION OF STOCKS IN COLD STORAGE",
  "CONTRACTORS PLANT AND MACHINERY SCHEDULE",
  // Property Products
  "FIRE & PERILS",
  "PROPERTY ALL RISKS",
  "BUSINESS INTERRUPTION ( Loss of Profits, Additional/Increased Cost of Working, Auditors Fee etc.)",
  "HOUSE HOLDER/OWNER COMPREHENSIVE",
  "OFFICE CONTENTS",
  "HOTEL COMP RISK",
  "Contingent Business Interruption (CBI) if written in accordance with the Contingent Business Interruption (CBI) Clause in the Contractual Wording",
  "MECHANICAL/ELECTRICAL BREKDOWN",
  "BURGLARY when written in conjunction with fire",
  "MONEY/CASH (CIT)",
  "FIDELITY GUARANTEE (FG)",
  "PUBLIC LIABILITY/TPL if also covered under a Fire or PAR"
] as const;

// Product Type Categories for Property & Engineering
export const ENGINEERING_PRODUCT_TYPES = [
  "CONTRACTORS ALL RISKS",
  "ERECTION ALL RISKS", 
  "Comprehensive Project (CP)",
  "Delay in Start Up (DSU) / Advanced Loss of Profit only in conjunction with CAR / EAR / CP sublimit 10% of Total Contract Value maximum USD 1,361,470",
  "Contractor's Plant and Machinery (CPM) including own damage losses of self propelled CPM's whilst in transit on the road",
  "Third Party Liability when written in conjunction with CAR / EAR / CPM / BPV only",
  "MACHINERY ALL RISKS",
  "MACHINERY BREAKDOWN",
  "LOSS OF PROFIT FOLLOWING MACHINERY BREAKDOWN",
  "BOILER AND PRESSURE VESSEL",
  "ELECTRONIC EQUIPMENT",
  "DETERIORATION OF STOCKS IN COLD STORAGE",
  "CONTRACTORS PLANT AND MACHINERY SCHEDULE"
] as const;

export const PROPERTY_PRODUCT_TYPES = [
  "FIRE & PERILS",
  "PROPERTY ALL RISKS",
  "BUSINESS INTERRUPTION ( Loss of Profits, Additional/Increased Cost of Working, Auditors Fee etc.)",
  "HOUSE HOLDER/OWNER COMPREHENSIVE",
  "OFFICE CONTENTS",
  "HOTEL COMP RISK",
  "Contingent Business Interruption (CBI) if written in accordance with the Contingent Business Interruption (CBI) Clause in the Contractual Wording",
  "MECHANICAL/ELECTRICAL BREKDOWN",
  "BURGLARY when written in conjunction with fire",
  "MONEY/CASH (CIT)",
  "FIDELITY GUARANTEE (FG)",
  "PUBLIC LIABILITY/TPL if also covered under a Fire or PAR"
] as const;

export const BUSINESS_TYPES = [
  "New Business",
  "Renewal"
] as const;

export type MarineProductType = typeof MARINE_PRODUCT_TYPES[number];
export type PropertyEngineeringProductType = typeof PROPERTY_ENGINEERING_PRODUCT_TYPES[number];
export type EngineeringProductType = typeof ENGINEERING_PRODUCT_TYPES[number];
export type PropertyProductType = typeof PROPERTY_PRODUCT_TYPES[number];
export type BusinessType = typeof BUSINESS_TYPES[number];

export const ORDER_STATUSES = [
  "Firm Order Received",
  "COI Issued",
  "KYC Pending",
  "KYC Completed"
] as const;

export const CURRENCIES = [
  "AED",
  "USD",
  "EUR"
] as const;

export type Currency = typeof CURRENCIES[number];
export type OrderStatus = (typeof ORDER_STATUSES)[number];

export const QUOTATION_STATUSES = [
  "Open",
  "Confirmed",
  "Decline"
] as const;

export type QuotationStatus = typeof QUOTATION_STATUSES[number];

// Marine tables (existing - keep as is to preserve data)
export const orders = pgTable("orders", {
  id: serial("id").primaryKey(),
  brokerName: text("broker_name").notNull(),
  insuredName: text("insured_name").notNull(),
  marineProductType: text("marine_product_type").notNull(),
  businessType: text("business_type").notNull(),
  premium: numeric("premium").notNull(),
  currency: text("currency").notNull(),
  orderDate: timestamp("order_date").notNull(),
  statuses: text("statuses").array().notNull(),
  notes: text("notes"),
  requiresPreConditionSurvey: boolean("requires_pre_condition_survey").default(false).notNull(),
  createdBy: serial("created_by").references(() => users.id),
  lastUpdated: timestamp("last_updated").notNull(),
  year: smallint("year").default(2025).notNull(),
});

export const quotations = pgTable("quotations", {
  id: serial("id").primaryKey(),
  brokerName: text("broker_name").notNull(),
  insuredName: text("insured_name").notNull(),
  marineProductType: text("marine_product_type").notNull(),
  estimatedPremium: numeric("estimated_premium").notNull(),
  currency: text("currency").notNull(),
  quotationDate: timestamp("quotation_date").notNull(),
  status: text("status").notNull(),
  declineReason: text("decline_reason"),
  notes: text("notes"),
  requiresPreConditionSurvey: boolean("requires_pre_condition_survey").default(false).notNull(),
  createdBy: serial("created_by").references(() => users.id),
  lastUpdated: timestamp("last_updated").notNull(),
  year: smallint("year").default(2025).notNull(),
});

// Property & Engineering tables
export const propertyEngineeringOrders = pgTable("property_engineering_orders", {
  id: serial("id").primaryKey(),
  brokerName: text("broker_name").notNull(),
  insuredName: text("insured_name").notNull(),
  productType: text("product_type").notNull(),
  coverGroup: text("cover_group").notNull(), // ENGINEERING or PROPERTY
  businessType: text("business_type").notNull(),
  premium: numeric("premium").notNull(),
  currency: text("currency").notNull(),
  orderDate: timestamp("order_date").notNull(),
  statuses: text("statuses").array().notNull(),
  notes: text("notes"),
  requiresPreConditionSurvey: boolean("requires_pre_condition_survey").default(false).notNull(),
  createdBy: serial("created_by").references(() => users.id),
  lastUpdated: timestamp("last_updated").notNull(),
  year: smallint("year").default(2025).notNull(),
});

export const propertyEngineeringQuotations = pgTable("property_engineering_quotations", {
  id: serial("id").primaryKey(),
  brokerName: text("broker_name").notNull(),
  insuredName: text("insured_name").notNull(),
  productType: text("product_type").notNull(),
  coverGroup: text("cover_group").notNull(), // ENGINEERING or PROPERTY
  estimatedPremium: numeric("estimated_premium").notNull(),
  currency: text("currency").notNull(),
  quotationDate: timestamp("quotation_date").notNull(),
  status: text("status").notNull(),
  declineReason: text("decline_reason"),
  notes: text("notes"),
  requiresPreConditionSurvey: boolean("requires_pre_condition_survey").default(false).notNull(),
  createdBy: serial("created_by").references(() => users.id),
  lastUpdated: timestamp("last_updated").notNull(),
  year: smallint("year").default(2025).notNull(),
});

export const statusLogs = pgTable("status_logs", {
  id: serial("id").primaryKey(),
  orderId: serial("order_id").references(() => orders.id),
  statuses: text("statuses").array().notNull(),
  timestamp: timestamp("timestamp").notNull(),
  notes: text("notes"),
});

export const propertyEngineeringStatusLogs = pgTable("property_engineering_status_logs", {
  id: serial("id").primaryKey(),
  orderId: serial("order_id").references(() => propertyEngineeringOrders.id),
  statuses: text("statuses").array().notNull(),
  timestamp: timestamp("timestamp").notNull(),
  notes: text("notes"),
});

export const insertUserSchema = createInsertSchema(users).pick({
  username: true,
  password: true,
  department: true,
}).extend({
  department: z.enum(LINES_OF_BUSINESS),
});

export const insertOrderSchema = createInsertSchema(orders)
  .pick({
    brokerName: true,
    insuredName: true,
    marineProductType: true,
    businessType: true,
    premium: true,
    currency: true,
    orderDate: true,
    statuses: true,
    notes: true,
    requiresPreConditionSurvey: true,
  })
  .extend({
    orderDate: z.string().transform(str => new Date(str)),
    marineProductType: z.enum(MARINE_PRODUCT_TYPES),
    businessType: z.enum(BUSINESS_TYPES),
    currency: z.enum(CURRENCIES),
    premium: z.string()
      .refine((val) => !isNaN(parseFloat(val)) && isFinite(Number(val)), {
        message: "Premium must be a valid number"
      })
      .transform(str => parseFloat(str)),
    statuses: z.array(z.enum(ORDER_STATUSES)),
    requiresPreConditionSurvey: z.boolean().default(false),
  });

// Form schema that allows "Policy Issued" status for UI forms
export const orderFormSchema = createInsertSchema(orders)
  .pick({
    brokerName: true,
    insuredName: true,
    marineProductType: true,
    businessType: true,
    premium: true,
    currency: true,
    orderDate: true,
    statuses: true,
    notes: true,
    requiresPreConditionSurvey: true,
  })
  .extend({
    orderDate: z.string().transform(str => new Date(str)),
    marineProductType: z.enum(MARINE_PRODUCT_TYPES),
    businessType: z.enum(BUSINESS_TYPES),
    currency: z.enum(CURRENCIES),
    premium: z.string()
      .refine((val) => !isNaN(parseFloat(val)) && isFinite(Number(val)), {
        message: "Premium must be a valid number"
      })
      .transform(str => parseFloat(str)),
    statuses: z.array(z.enum([...ORDER_STATUSES, "Policy Issued"] as const)),
    requiresPreConditionSurvey: z.boolean().default(false),
  });

export const insertPropertyEngineeringOrderSchema = createInsertSchema(propertyEngineeringOrders)
  .pick({
    brokerName: true,
    insuredName: true,
    productType: true,
    coverGroup: true,
    businessType: true,
    premium: true,
    currency: true,
    orderDate: true,
    statuses: true,
    notes: true,
    requiresPreConditionSurvey: true,
  })
  .extend({
    orderDate: z.string().transform(str => new Date(str)),
    productType: z.enum(PROPERTY_ENGINEERING_PRODUCT_TYPES),
    coverGroup: z.enum(["ENGINEERING", "PROPERTY"]),
    businessType: z.enum(BUSINESS_TYPES),
    currency: z.enum(CURRENCIES),
    premium: z.string()
      .refine((val) => !isNaN(parseFloat(val)) && isFinite(Number(val)), {
        message: "Premium must be a valid number"
      })
      .transform(str => parseFloat(str)),
    statuses: z.array(z.enum([...ORDER_STATUSES, "Policy Issued"] as const)),
    requiresPreConditionSurvey: z.boolean().default(false),
  });

export const insertQuotationSchema = createInsertSchema(quotations)
  .pick({
    brokerName: true,
    insuredName: true,
    marineProductType: true,
    estimatedPremium: true,
    currency: true,
    quotationDate: true,
    status: true,
    declineReason: true,
    notes: true,
    requiresPreConditionSurvey: true,
  })
  .extend({
    quotationDate: z.string().transform(str => new Date(str)),
    marineProductType: z.enum(MARINE_PRODUCT_TYPES),
    currency: z.enum(CURRENCIES),
    status: z.enum(QUOTATION_STATUSES),
    estimatedPremium: z.string()
      .refine((val) => !isNaN(parseFloat(val)) && isFinite(Number(val)) && parseFloat(val) >= 0, {
        message: "Estimated premium must be a valid number greater than or equal to 0"
      })
      .transform(str => parseFloat(str)),
    declineReason: z.string().optional().nullable(),
    requiresPreConditionSurvey: z.boolean().default(false),
  });

export const insertPropertyEngineeringQuotationSchema = createInsertSchema(propertyEngineeringQuotations)
  .pick({
    brokerName: true,
    insuredName: true,
    productType: true,
    coverGroup: true,
    estimatedPremium: true,
    currency: true,
    quotationDate: true,
    status: true,
    declineReason: true,
    notes: true,
    requiresPreConditionSurvey: true,
  })
  .extend({
    quotationDate: z.string().transform(str => new Date(str)),
    productType: z.enum(PROPERTY_ENGINEERING_PRODUCT_TYPES),
    coverGroup: z.enum(["ENGINEERING", "PROPERTY"]),
    currency: z.enum(CURRENCIES),
    status: z.enum(QUOTATION_STATUSES),
    estimatedPremium: z.string()
      .refine((val) => !isNaN(parseFloat(val)) && isFinite(Number(val)) && parseFloat(val) >= 0, {
        message: "Estimated premium must be a valid number greater than or equal to 0"
      })
      .transform(str => parseFloat(str)),
    declineReason: z.string().optional().nullable(),
    requiresPreConditionSurvey: z.boolean().default(false),
  });

export const updateOrderSchema = createInsertSchema(orders).pick({
  brokerName: true,
  insuredName: true,
  marineProductType: true,
  businessType: true,
  premium: true,
  currency: true,
  orderDate: true,
  statuses: true,
  notes: true,
  requiresPreConditionSurvey: true,
}).extend({
  orderDate: z.string().transform(str => new Date(str)).optional(),
  premium: z.string()
    .refine((val) => !isNaN(parseFloat(val)) && isFinite(Number(val)), {
      message: "Premium must be a valid number"
    })
    .transform(str => parseFloat(str)).optional(),
  marineProductType: z.enum(MARINE_PRODUCT_TYPES).optional(),
  businessType: z.enum(BUSINESS_TYPES).optional(),
  currency: z.enum(CURRENCIES).optional(),
  statuses: z.array(z.enum([...ORDER_STATUSES, "Policy Issued"] as const)).optional(),
  requiresPreConditionSurvey: z.boolean().optional(),
}).partial();

export const updatePropertyEngineeringOrderSchema = createInsertSchema(propertyEngineeringOrders).pick({
  brokerName: true,
  insuredName: true,
  productType: true,
  coverGroup: true,
  businessType: true,
  premium: true,
  currency: true,
  orderDate: true,
  statuses: true,
  notes: true,
  requiresPreConditionSurvey: true,
}).extend({
  orderDate: z.string().transform(str => new Date(str)).optional(),
  premium: z.string()
    .refine((val) => !isNaN(parseFloat(val)) && isFinite(Number(val)), {
      message: "Premium must be a valid number"
    })
    .transform(str => parseFloat(str)).optional(),
  productType: z.enum(PROPERTY_ENGINEERING_PRODUCT_TYPES).optional(),
  coverGroup: z.enum(["ENGINEERING", "PROPERTY"]).optional(),
  businessType: z.enum(BUSINESS_TYPES).optional(),
  currency: z.enum(CURRENCIES).optional(),
  statuses: z.array(z.enum([...ORDER_STATUSES, "Policy Issued"] as const)).optional(),
  requiresPreConditionSurvey: z.boolean().optional(),
}).partial();

export type InsertUser = z.infer<typeof insertUserSchema>;
export type InsertOrder = z.infer<typeof insertOrderSchema>;
export type InsertPropertyEngineeringOrder = z.infer<typeof insertPropertyEngineeringOrderSchema>;
export type InsertQuotation = z.infer<typeof insertQuotationSchema>;
export type InsertPropertyEngineeringQuotation = z.infer<typeof insertPropertyEngineeringQuotationSchema>;
export type UpdateOrder = z.infer<typeof updateOrderSchema>;
export type UpdatePropertyEngineeringOrder = z.infer<typeof updatePropertyEngineeringOrderSchema>;
export type User = typeof users.$inferSelect;
export type Order = typeof orders.$inferSelect;
export type PropertyEngineeringOrder = typeof propertyEngineeringOrders.$inferSelect;
export type Quotation = typeof quotations.$inferSelect;
export type PropertyEngineeringQuotation = typeof propertyEngineeringQuotations.$inferSelect;
export type StatusLog = typeof statusLogs.$inferSelect;
export type PropertyEngineeringStatusLog = typeof propertyEngineeringStatusLogs.$inferSelect;

// Liability & Financial Product Types
export const LIABILITY_PRODUCT_TYPES = [
  "Commercial General Liability (CGL) Insurance",
  "Public Liability Insurance",
  "Product Liability Insurance",
  "Professional Indemnity (Errors & Omissions) Insurance",
  "Employers' Liability Insurance",
  "Workers' Compensation Insurance",
  "Directors & Officers (D&O) Liability Insurance",
  "Commercial Auto Liability Insurance",
  "Umbrella/Excess Liability Insurance",
  "Product Recall Insurance",
  "Medical Malpractice Insurance",
  "Cyber Liability Insurance",
  "Environmental Liability Insurance",
  "Personal Liability Insurance",
  "Airside Aviation Liability Insurance",
  "Event Liability Insurance",
  "Employment Practices Liability Insurance (EPL)",
  "Crime Insurance (Commercial Crime/Fidelity Guarantee)",
  "Financial Institutions Professional Indemnity Insurance",
  "Bankers Blanket Bond",
  "Public Offering of Securities Insurance (POSI)",
  "Pension Trustee Liability Insurance",
  "Fiduciary Liability Insurance",
  "Prospectus Liability Insurance"
] as const;

// Liability Quotations Table
export const liabilityQuotations = pgTable("liability_quotations", {
  id: serial("id").primaryKey(),
  brokerName: varchar("broker_name", { length: 255 }).notNull(),
  insuredName: varchar("insured_name", { length: 255 }).notNull(),
  productType: varchar("product_type", { length: 100 }).notNull(),
  estimatedPremium: decimal("estimated_premium", { precision: 10, scale: 2 }).notNull(),
  currency: varchar("currency", { length: 10 }).notNull(),
  quotationDate: date("quotation_date").notNull(),
  status: varchar("status", { length: 50 }).notNull(),
  declineReason: text("decline_reason"),
  notes: text("notes"),
  userId: integer("user_id").notNull().references(() => users.id),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
  year: smallint("year").default(2025).notNull(),
});

export type LiabilityQuotation = InferSelectModel<typeof liabilityQuotations>;
export type InsertLiabilityQuotation = InferInsertModel<typeof liabilityQuotations>;

// Liability Orders Table
export const liabilityOrders = pgTable("liability_orders", {
  id: serial("id").primaryKey(),
  brokerName: varchar("broker_name", { length: 255 }).notNull(),
  insuredName: varchar("insured_name", { length: 255 }).notNull(),
  productType: varchar("product_type", { length: 100 }).notNull(),
  businessType: varchar("business_type", { length: 50 }).notNull(),
  premium: decimal("premium", { precision: 10, scale: 2 }).notNull(),
  currency: varchar("currency", { length: 10 }).notNull(),
  orderDate: date("order_date").notNull(),
  statuses: text("statuses").array().notNull().default([]),
  notes: text("notes"),
  userId: integer("user_id").notNull().references(() => users.id),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
  year: smallint("year").default(2025).notNull(),
});

export type LiabilityOrder = InferSelectModel<typeof liabilityOrders>;
export type InsertLiabilityOrder = InferInsertModel<typeof liabilityOrders>;

// Insert schemas for Liability Quotations
export const insertLiabilityQuotationSchema = createInsertSchema(liabilityQuotations)
  .pick({
    brokerName: true,
    insuredName: true,
    productType: true,
    estimatedPremium: true,
    currency: true,
    quotationDate: true,
    status: true,
    declineReason: true,
    notes: true,
  })
  .extend({
    quotationDate: z.string().transform(str => new Date(str)),
    productType: z.enum(LIABILITY_PRODUCT_TYPES),
    currency: z.enum(CURRENCIES),
    status: z.enum(QUOTATION_STATUSES),
    estimatedPremium: z.string()
      .refine((val) => !isNaN(parseFloat(val)) && isFinite(Number(val)) && parseFloat(val) >= 0, {
        message: "Estimated premium must be a valid number greater than or equal to 0"
      })
      .transform(str => parseFloat(str)),
    declineReason: z.string().nullable().optional(),
    notes: z.string().nullable().optional(),
  });

// Insert schemas for Liability Orders
export const insertLiabilityOrderSchema = createInsertSchema(liabilityOrders)
  .pick({
    brokerName: true,
    insuredName: true,
    productType: true,
    businessType: true,
    premium: true,
    currency: true,
    orderDate: true,
    statuses: true,
    notes: true,
  })
  .extend({
    orderDate: z.string().transform(str => new Date(str)),
    productType: z.enum(LIABILITY_PRODUCT_TYPES),
    businessType: z.enum(BUSINESS_TYPES),
    currency: z.enum(CURRENCIES),
    premium: z.string()
      .refine((val) => !isNaN(parseFloat(val)) && isFinite(Number(val)), {
        message: "Premium must be a valid number"
      })
      .transform(str => parseFloat(str)),
    statuses: z.array(z.enum([...ORDER_STATUSES, "Policy Issued"] as const)),
    notes: z.string().nullable().optional(),
  });

export const AIQuotationExtractSchema = z.object({
  brokerName: z.string().nullish(),
  insuredName: z.string().nullish(),
  marineProductType: z.string(),
  estimatedPremium: z.union([z.number(), z.string()]),
  currency: z.string(),
  quotationDate: z.string(),
  status: z.string(),
  declineReason: z.string().nullish(),
  notes: z.string().nullish(),
  requiresPreConditionSurvey: z.boolean().optional(),
});