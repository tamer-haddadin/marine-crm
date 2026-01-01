import { IStorage } from "./types";
import session from "express-session";
import connectPg from "connect-pg-simple";
import { db } from "./db";
import { pool } from "./db";
import { 
  users, 
  orders, 
  quotations, 
  statusLogs, 
  propertyEngineeringOrders,
  propertyEngineeringQuotations,
  propertyEngineeringStatusLogs,
  liabilityQuotations,
  liabilityOrders,
  appSettings
} from "@shared/schema";
import { eq, sql, and, between } from "drizzle-orm";
import { 
  InsertUser, 
  InsertOrder, 
  InsertQuotation, 
  InsertPropertyEngineeringOrder,
  InsertPropertyEngineeringQuotation,
  User, 
  Order, 
  Quotation, 
  PropertyEngineeringOrder,
  PropertyEngineeringQuotation,
  StatusLog, 
  PropertyEngineeringStatusLog,
  UpdateOrder, 
  UpdatePropertyEngineeringOrder,
  MarineProductType, 
  PropertyEngineeringProductType,
  Currency,
  InsertLiabilityQuotation,
  LiabilityQuotation,
  InsertLiabilityOrder,
  LiabilityOrder
} from "@shared/schema";

const PostgresSessionStore = connectPg(session);

export class DatabaseStorage implements IStorage {
  public sessionStore: session.Store;

  constructor() {
    this.sessionStore = new PostgresSessionStore({
      pool,
      createTableIfMissing: true,
    });
  }

  // App Settings Methods
  async getActiveYear(): Promise<number> {
    try {
      const result = await db.select().from(appSettings).where(eq(appSettings.key, 'active_year'));
      if (result.length > 0) {
        return parseInt(result[0].value, 10);
      }
      return new Date().getFullYear(); // Default to current year
    } catch (error) {
      console.error('Error getting active year:', error);
      return new Date().getFullYear();
    }
  }

  async setActiveYear(year: number): Promise<void> {
    try {
      await db.insert(appSettings)
        .values({ key: 'active_year', value: year.toString(), updatedAt: new Date() })
        .onConflictDoUpdate({
          target: appSettings.key,
          set: { value: year.toString(), updatedAt: new Date() }
        });
    } catch (error) {
      console.error('Error setting active year:', error);
      throw error;
    }
  }

  async getUser(id: number): Promise<User | undefined> {
    const result = await db.select().from(users).where(eq(users.id, id));
    return result[0];
  }

  async getUserByUsername(username: string): Promise<User | undefined> {
    const result = await db.select().from(users).where(eq(users.username, username));
    return result[0];
  }

  async createUser(insertUser: InsertUser): Promise<User> {
    const result = await db.insert(users).values(insertUser).returning();
    return result[0];
  }

  async createOrder(insertOrder: InsertOrder, userId: number): Promise<Order> {
    const activeYear = await this.getActiveYear();
    const result = await db
      .insert(orders)
      .values({
        brokerName: insertOrder.brokerName,
        insuredName: insertOrder.insuredName,
        marineProductType: insertOrder.marineProductType,
        businessType: insertOrder.businessType,
        premium: String(insertOrder.premium),
        currency: insertOrder.currency,
        orderDate: insertOrder.orderDate,
        statuses: insertOrder.statuses,
        notes: insertOrder.notes || null,
        requiresPreConditionSurvey:
          insertOrder.requiresPreConditionSurvey ?? false,
        createdBy: userId,
        lastUpdated: new Date(),
        year: activeYear,
      })
      .returning();

    const order = result[0];

    await this.createStatusLog({
      orderId: order.id,
      statuses: insertOrder.statuses,
      timestamp: new Date(),
      notes: order.notes,
    });

    return order;
  }

  async updateOrder(id: number, updateData: UpdateOrder): Promise<Order> {
    const currentOrder = await db
      .select()
      .from(orders)
      .where(eq(orders.id, id));

    if (!currentOrder.length) {
      throw new Error("Order not found");
    }

    // Build update object with only provided fields
    const updateFields: any = {
      lastUpdated: new Date(),
    };

    if (updateData.brokerName !== undefined) updateFields.brokerName = updateData.brokerName;
    if (updateData.insuredName !== undefined) updateFields.insuredName = updateData.insuredName;
    if (updateData.marineProductType !== undefined) updateFields.marineProductType = updateData.marineProductType;
    if (updateData.businessType !== undefined) updateFields.businessType = updateData.businessType;
    if (updateData.premium !== undefined) updateFields.premium = String(updateData.premium);
    if (updateData.currency !== undefined) updateFields.currency = updateData.currency;
    if (updateData.orderDate !== undefined) updateFields.orderDate = updateData.orderDate;
    if (updateData.statuses !== undefined) updateFields.statuses = updateData.statuses;
    if (updateData.notes !== undefined) updateFields.notes = updateData.notes;
    if (updateData.requiresPreConditionSurvey !== undefined) updateFields.requiresPreConditionSurvey = updateData.requiresPreConditionSurvey;

    const result = await db
      .update(orders)
      .set(updateFields)
      .where(eq(orders.id, id))
      .returning();

    const updatedOrder = result[0];
    if (!updatedOrder) {
      throw new Error("Failed to update order");
    }

    // Only create status log if statuses were updated
    if (updateData.statuses !== undefined) {
    await this.createStatusLog({
      orderId: id,
      statuses: updateData.statuses,
      timestamp: new Date(),
      notes: updateData.notes || null,
    });
    }

    return updatedOrder;
  }

  async getOrder(id: number): Promise<Order | undefined> {
    const result = await db.select().from(orders).where(eq(orders.id, id));
    return result[0];
  }

  async listOrders(userId: number): Promise<Order[]> {
    const activeYear = await this.getActiveYear();
    const result = await db
      .select()
      .from(orders)
      .where(and(
        eq(orders.year, activeYear),
        sql`NOT (${orders.statuses} && ARRAY['Policy Issued']::text[])`
      ));
    return result;
  }

  // Property & Engineering Order Methods
  async createPropertyEngineeringOrder(insertOrder: InsertPropertyEngineeringOrder, userId: number): Promise<PropertyEngineeringOrder> {
    const activeYear = await this.getActiveYear();
    const result = await db.insert(propertyEngineeringOrders).values({
      brokerName: insertOrder.brokerName,
      insuredName: insertOrder.insuredName,
      productType: insertOrder.productType,
      coverGroup: insertOrder.coverGroup,
      businessType: insertOrder.businessType,
      premium: String(insertOrder.premium),
      currency: insertOrder.currency,
      orderDate: insertOrder.orderDate,
      statuses: insertOrder.statuses,
      notes: insertOrder.notes || null,
      createdBy: userId,
      lastUpdated: new Date(),
      year: activeYear,
    }).returning();

    const order = result[0];

    await this.createPropertyEngineeringStatusLog({
      orderId: order.id,
      statuses: insertOrder.statuses,
      timestamp: new Date(),
      notes: order.notes,
    });

    return order;
  }

  async updatePropertyEngineeringOrder(id: number, updateData: UpdatePropertyEngineeringOrder): Promise<PropertyEngineeringOrder> {
    const currentOrder = await db
      .select()
      .from(propertyEngineeringOrders)
      .where(eq(propertyEngineeringOrders.id, id));

    if (!currentOrder.length) {
      throw new Error("Property Engineering Order not found");
    }

    // Build update object with only provided fields
    const updateFields: any = {
      lastUpdated: new Date(),
    };

    if (updateData.brokerName !== undefined) updateFields.brokerName = updateData.brokerName;
    if (updateData.insuredName !== undefined) updateFields.insuredName = updateData.insuredName;
    if (updateData.productType !== undefined) updateFields.productType = updateData.productType;
    if (updateData.coverGroup !== undefined) updateFields.coverGroup = updateData.coverGroup;
    if (updateData.businessType !== undefined) updateFields.businessType = updateData.businessType;
    if (updateData.premium !== undefined) updateFields.premium = String(updateData.premium);
    if (updateData.currency !== undefined) updateFields.currency = updateData.currency;
    if (updateData.orderDate !== undefined) updateFields.orderDate = updateData.orderDate;
    if (updateData.statuses !== undefined) updateFields.statuses = updateData.statuses;
    if (updateData.notes !== undefined) updateFields.notes = updateData.notes;
    if (updateData.requiresPreConditionSurvey !== undefined) updateFields.requiresPreConditionSurvey = updateData.requiresPreConditionSurvey;

    const result = await db
      .update(propertyEngineeringOrders)
      .set(updateFields)
      .where(eq(propertyEngineeringOrders.id, id))
      .returning();

    const updatedOrder = result[0];
    if (!updatedOrder) {
      throw new Error("Failed to update Property Engineering order");
    }

    // Only create status log if statuses were updated
    if (updateData.statuses !== undefined) {
      await this.createPropertyEngineeringStatusLog({
        orderId: id,
        statuses: updateData.statuses,
        timestamp: new Date(),
        notes: updateData.notes || null,
      });
    }

    return updatedOrder;
  }

  async getPropertyEngineeringOrder(id: number): Promise<PropertyEngineeringOrder | undefined> {
    const result = await db.select().from(propertyEngineeringOrders).where(eq(propertyEngineeringOrders.id, id));
    return result[0];
  }

  async listPropertyEngineeringOrders(userId: number): Promise<PropertyEngineeringOrder[]> {
    const activeYear = await this.getActiveYear();
    const result = await db
      .select()
      .from(propertyEngineeringOrders)
      .where(and(
        eq(propertyEngineeringOrders.year, activeYear),
        sql`NOT (${propertyEngineeringOrders.statuses} && ARRAY['Policy Issued']::text[])`
      ));
    return result;
  }

  async listPropertyEngineeringOrdersInDateRange(
    userId: number,
    startDate?: Date,
    endDate?: Date,
    status?: string,
    includeAll: boolean = false
  ): Promise<PropertyEngineeringOrder[]> {
    try {
      const activeYear = await this.getActiveYear();
      console.log('listPropertyEngineeringOrdersInDateRange called with dates:', {
        startDate: startDate?.toISOString(),
        endDate: endDate?.toISOString(),
        status,
        includeAll,
        activeYear
      });

      // Build all conditions as an array and combine with AND
      const conditions: any[] = [eq(propertyEngineeringOrders.year, activeYear)];

      // Build clean start/end date filters using raw SQL for date comparison
      if (startDate && endDate) {
        const startDateStr = startDate.toISOString().split('T')[0];
        const endDateStr = endDate.toISOString().split('T')[0];
        console.log(`Using date range: ${startDateStr} to ${endDateStr}`);
        conditions.push(sql`TO_CHAR(${propertyEngineeringOrders.orderDate}, 'YYYY-MM-DD') BETWEEN ${startDateStr} AND ${endDateStr}`);
      } else if (startDate) {
        const startDateStr = startDate.toISOString().split('T')[0];
        console.log(`Using start date: ${startDateStr}`);
        conditions.push(sql`TO_CHAR(${propertyEngineeringOrders.orderDate}, 'YYYY-MM-DD') >= ${startDateStr}`);
      } else if (endDate) {
        const endDateStr = endDate.toISOString().split('T')[0];
        console.log(`Using end date: ${endDateStr}`);
        conditions.push(sql`TO_CHAR(${propertyEngineeringOrders.orderDate}, 'YYYY-MM-DD') <= ${endDateStr}`);
      }

      // Status filtering logic
      if (!includeAll) {
        if (status) {
          if (status === "Policy Issued") {
            conditions.push(sql`${propertyEngineeringOrders.statuses} && ARRAY['Policy Issued']::text[]`);
          } else {
            conditions.push(sql`NOT (${propertyEngineeringOrders.statuses} && ARRAY['Policy Issued']::text[])`);
            conditions.push(sql`${propertyEngineeringOrders.statuses} && ARRAY[${status}]::text[]`);
          }
        } else {
          conditions.push(sql`NOT (${propertyEngineeringOrders.statuses} && ARRAY['Policy Issued']::text[])`);
        }
      }

      const result = await db.select().from(propertyEngineeringOrders).where(and(...conditions));
      console.log(`Found ${result.length} P&E orders in date range`);
      
      if (result.length > 0) {
        console.log('Sample P&E order dates:');
        result.slice(0, 3).forEach(o => {
          console.log(`- ${o.brokerName}: ${new Date(o.orderDate).toISOString()}`);
        });
      }
      
      return result;
    } catch (error) {
      console.error('Error in listPropertyEngineeringOrdersInDateRange:', error);
      throw error;
    }
  }

  async deletePropertyEngineeringOrder(id: number): Promise<void> {
    await db.delete(propertyEngineeringStatusLogs).where(eq(propertyEngineeringStatusLogs.orderId, id));
    await db.delete(propertyEngineeringOrders).where(eq(propertyEngineeringOrders.id, id));
  }

  async createQuotation(insertQuotation: InsertQuotation, userId: number): Promise<Quotation> {
    const activeYear = await this.getActiveYear();
    const result = await db.insert(quotations).values({
      brokerName: insertQuotation.brokerName,
      insuredName: insertQuotation.insuredName,
      marineProductType: insertQuotation.marineProductType,
      estimatedPremium: String(insertQuotation.estimatedPremium),
      currency: insertQuotation.currency,
      quotationDate: insertQuotation.quotationDate,
      status: insertQuotation.status,
      declineReason: insertQuotation.declineReason || null,
      notes: insertQuotation.notes || null,
      createdBy: userId,
      lastUpdated: new Date(),
      requiresPreConditionSurvey: insertQuotation.requiresPreConditionSurvey,
      year: activeYear,
    }).returning();

    const quotation = result[0];
    if (insertQuotation.status === "Confirmed") {
      await this.createFirmOrderFromQuotation(quotation);
    }

    return quotation;
  }

  async updateQuotation(id: number, updateQuotation: InsertQuotation): Promise<Quotation> {
    const currentQuotation = await db
      .select()
      .from(quotations)
      .where(eq(quotations.id, id));

    const result = await db
      .update(quotations)
      .set({
        brokerName: updateQuotation.brokerName,
        insuredName: updateQuotation.insuredName,
        marineProductType: updateQuotation.marineProductType,
        estimatedPremium: String(updateQuotation.estimatedPremium),
        currency: updateQuotation.currency,
        quotationDate: updateQuotation.quotationDate,
        status: updateQuotation.status,
        declineReason: updateQuotation.declineReason || null,
        notes: updateQuotation.notes || null,
        lastUpdated: new Date(),
        requiresPreConditionSurvey: updateQuotation.requiresPreConditionSurvey
      })
      .where(eq(quotations.id, id))
      .returning();

    const quotation = result[0];
    if (currentQuotation[0] &&
      currentQuotation[0].status !== "Confirmed" &&
      updateQuotation.status === "Confirmed") {
      await this.createFirmOrderFromQuotation(quotation);
    }

    return quotation;
  }

  async getQuotation(id: number): Promise<Quotation | undefined> {
    if (typeof id !== 'number' || isNaN(id)) {
      throw new Error('Invalid quotation ID');
    }
    const result = await db.select().from(quotations).where(eq(quotations.id, id));
    return result[0];
  }

  async listQuotations(userId: number): Promise<Quotation[]> {
    const activeYear = await this.getActiveYear();
    const result = await db.select().from(quotations).where(eq(quotations.year, activeYear));
    return result;
  }

  async deleteQuotation(id: number): Promise<void> {
    await db.delete(quotations).where(eq(quotations.id, id));
  }

  // Property & Engineering Quotation Methods
  async createPropertyEngineeringQuotation(insertQuotation: InsertPropertyEngineeringQuotation, userId: number): Promise<PropertyEngineeringQuotation> {
    const activeYear = await this.getActiveYear();
    const result = await db.insert(propertyEngineeringQuotations).values({
      brokerName: insertQuotation.brokerName,
      insuredName: insertQuotation.insuredName,
      productType: insertQuotation.productType,
      coverGroup: insertQuotation.coverGroup,
      estimatedPremium: String(insertQuotation.estimatedPremium),
      currency: insertQuotation.currency,
      quotationDate: insertQuotation.quotationDate,
      status: insertQuotation.status,
      declineReason: insertQuotation.declineReason || null,
      notes: insertQuotation.notes || null,
      createdBy: userId,
      lastUpdated: new Date(),
      requiresPreConditionSurvey: insertQuotation.requiresPreConditionSurvey,
      year: activeYear,
    }).returning();

    const quotation = result[0];
    if (insertQuotation.status === "Confirmed") {
      await this.createPropertyEngineeringFirmOrderFromQuotation(quotation);
    }

    return quotation;
  }

  async updatePropertyEngineeringQuotation(id: number, updateQuotation: InsertPropertyEngineeringQuotation): Promise<PropertyEngineeringQuotation> {
    const currentQuotation = await db
      .select()
      .from(propertyEngineeringQuotations)
      .where(eq(propertyEngineeringQuotations.id, id));

    const result = await db
      .update(propertyEngineeringQuotations)
      .set({
        brokerName: updateQuotation.brokerName,
        insuredName: updateQuotation.insuredName,
        productType: updateQuotation.productType,
        coverGroup: updateQuotation.coverGroup,
        estimatedPremium: String(updateQuotation.estimatedPremium),
        currency: updateQuotation.currency,
        quotationDate: updateQuotation.quotationDate,
        status: updateQuotation.status,
        declineReason: updateQuotation.declineReason || null,
        notes: updateQuotation.notes || null,
        lastUpdated: new Date(),
        requiresPreConditionSurvey: updateQuotation.requiresPreConditionSurvey
      })
      .where(eq(propertyEngineeringQuotations.id, id))
      .returning();

    const quotation = result[0];
    if (currentQuotation[0] &&
      currentQuotation[0].status !== "Confirmed" &&
      updateQuotation.status === "Confirmed") {
      await this.createPropertyEngineeringFirmOrderFromQuotation(quotation);
    }

    return quotation;
  }

  async getPropertyEngineeringQuotation(id: number): Promise<PropertyEngineeringQuotation | undefined> {
    if (typeof id !== 'number' || isNaN(id)) {
      throw new Error('Invalid Property Engineering quotation ID');
    }
    const result = await db.select().from(propertyEngineeringQuotations).where(eq(propertyEngineeringQuotations.id, id));
    return result[0];
  }

  async listPropertyEngineeringQuotations(userId: number): Promise<PropertyEngineeringQuotation[]> {
    const activeYear = await this.getActiveYear();
    const result = await db.select().from(propertyEngineeringQuotations).where(eq(propertyEngineeringQuotations.year, activeYear));
    return result;
  }

  async deletePropertyEngineeringQuotation(id: number): Promise<void> {
    await db.delete(propertyEngineeringQuotations).where(eq(propertyEngineeringQuotations.id, id));
  }

  async listPropertyEngineeringQuotationsInDateRange(
    userId: number,
    startDate?: Date,
    endDate?: Date,
    status?: string
  ): Promise<PropertyEngineeringQuotation[]> {
    try {
      const activeYear = await this.getActiveYear();
      console.log('listPropertyEngineeringQuotationsInDateRange called with dates:', {
        startDate: startDate?.toISOString(),
        endDate: endDate?.toISOString(),
        status,
        activeYear
      });

      // Build all conditions as an array and combine with AND
      const conditions: any[] = [eq(propertyEngineeringQuotations.year, activeYear)];

      // Build clean start/end date filters using raw SQL for date comparison
      if (startDate && endDate) {
        const startDateStr = startDate.toISOString().split('T')[0];
        const endDateStr = endDate.toISOString().split('T')[0];
        console.log(`Using date range: ${startDateStr} to ${endDateStr}`);
        conditions.push(sql`TO_CHAR(${propertyEngineeringQuotations.quotationDate}, 'YYYY-MM-DD') BETWEEN ${startDateStr} AND ${endDateStr}`);
      } else if (startDate) {
        const startDateStr = startDate.toISOString().split('T')[0];
        console.log(`Using start date: ${startDateStr}`);
        conditions.push(sql`TO_CHAR(${propertyEngineeringQuotations.quotationDate}, 'YYYY-MM-DD') >= ${startDateStr}`);
      } else if (endDate) {
        const endDateStr = endDate.toISOString().split('T')[0];
        console.log(`Using end date: ${endDateStr}`);
        conditions.push(sql`TO_CHAR(${propertyEngineeringQuotations.quotationDate}, 'YYYY-MM-DD') <= ${endDateStr}`);
      }

      // Status filtering logic
      if (status) {
        conditions.push(eq(propertyEngineeringQuotations.status, status));
      }

      const result = await db.select().from(propertyEngineeringQuotations).where(and(...conditions));
      console.log(`Found ${result.length} P&E quotations in date range`);
      
      if (result.length > 0) {
        console.log('Sample P&E quotation dates:');
        result.slice(0, 3).forEach(q => {
          console.log(`- ${q.brokerName}: ${new Date(q.quotationDate).toISOString()}`);
        });
      }
      
      return result;
    } catch (error) {
      console.error('Error in listPropertyEngineeringQuotationsInDateRange:', error);
      throw error;
    }
  }

  async createStatusLog(log: Omit<StatusLog, "id">): Promise<StatusLog> {
    const result = await db.insert(statusLogs).values(log).returning();
    return result[0];
  }

  async createPropertyEngineeringStatusLog(log: Omit<PropertyEngineeringStatusLog, "id">): Promise<PropertyEngineeringStatusLog> {
    const result = await db.insert(propertyEngineeringStatusLogs).values(log).returning();
    return result[0];
  }

  async getOrderLogs(orderId: number): Promise<StatusLog[]> {
    return db
      .select()
      .from(statusLogs)
      .where(eq(statusLogs.orderId, orderId))
      .orderBy(statusLogs.timestamp);
  }

  async getPropertyEngineeringOrderLogs(orderId: number): Promise<PropertyEngineeringStatusLog[]> {
    return db
      .select()
      .from(propertyEngineeringStatusLogs)
      .where(eq(propertyEngineeringStatusLogs.orderId, orderId))
      .orderBy(propertyEngineeringStatusLogs.timestamp);
  }

  async updateOrderAISuggestion(orderId: number, suggestion: string): Promise<void> {
    await db
      .update(orders)
      .set({ notes: suggestion })
      .where(eq(orders.id, orderId));
  }

  async deleteOrder(id: number): Promise<void> {
    await db.delete(statusLogs).where(eq(statusLogs.orderId, id));
    await db.delete(orders).where(eq(orders.id, id));
  }

  async createFirmOrderFromQuotation(quotation: Quotation): Promise<Order> {
    const activeYear = await this.getActiveYear();
    const result = await db.insert(orders).values({
      brokerName: quotation.brokerName,
      insuredName: quotation.insuredName,
      marineProductType: quotation.marineProductType as MarineProductType,
      businessType: "New Business",
      premium: quotation.estimatedPremium,
      currency: quotation.currency as Currency,
      orderDate: new Date(),
      statuses: ["Firm Order Received", "KYC Pending"],
      notes: quotation.notes || null,
      requiresPreConditionSurvey: quotation.requiresPreConditionSurvey,
      createdBy: quotation.createdBy,
      lastUpdated: new Date(),
      year: activeYear,
    }).returning();

    const order = result[0];
    await this.createStatusLog({
      orderId: order.id,
      statuses: ["Firm Order Received", "KYC Pending"],
      timestamp: new Date(),
      notes: order.notes,
    });

    return order;
  }

  async createPropertyEngineeringFirmOrderFromQuotation(quotation: PropertyEngineeringQuotation): Promise<PropertyEngineeringOrder> {
    const activeYear = await this.getActiveYear();
    const result = await db.insert(propertyEngineeringOrders).values({
      brokerName: quotation.brokerName,
      insuredName: quotation.insuredName,
      productType: quotation.productType as PropertyEngineeringProductType,
      coverGroup: quotation.coverGroup,
      businessType: "New Business",
      premium: quotation.estimatedPremium,
      currency: quotation.currency as Currency,
      orderDate: new Date(),
      statuses: ["Firm Order Received", "KYC Pending"],
      notes: quotation.notes || null,
      requiresPreConditionSurvey: quotation.requiresPreConditionSurvey,
      createdBy: quotation.createdBy,
      lastUpdated: new Date(),
      year: activeYear,
    }).returning();

    const order = result[0];
    await this.createPropertyEngineeringStatusLog({
      orderId: order.id,
      statuses: ["Firm Order Received", "KYC Pending"],
      timestamp: new Date(),
      notes: order.notes,
    });

    return order;
  }

  async listQuotationsInDateRange(
    userId: number,
    startDate?: Date,
    endDate?: Date,
    status?: string
  ): Promise<Quotation[]> {
    try {
      const activeYear = await this.getActiveYear();
      console.log('listQuotationsInDateRange called with dates:', {
        startDate: startDate?.toISOString(),
        endDate: endDate?.toISOString(),
        status,
        activeYear
      });

      // Build all conditions as an array and combine with AND
      const conditions: any[] = [eq(quotations.year, activeYear)];

      // Build clean start/end date filters using raw SQL for date comparison
      if (startDate && endDate) {
        const startDateStr = startDate.toISOString().split('T')[0];
        const endDateStr = endDate.toISOString().split('T')[0];
        console.log(`Using date range: ${startDateStr} to ${endDateStr}`);
        conditions.push(sql`TO_CHAR(${quotations.quotationDate}, 'YYYY-MM-DD') BETWEEN ${startDateStr} AND ${endDateStr}`);
      } else if (startDate) {
        const startDateStr = startDate.toISOString().split('T')[0];
        console.log(`Using start date: ${startDateStr}`);
        conditions.push(sql`TO_CHAR(${quotations.quotationDate}, 'YYYY-MM-DD') >= ${startDateStr}`);
      } else if (endDate) {
        const endDateStr = endDate.toISOString().split('T')[0];
        console.log(`Using end date: ${endDateStr}`);
        conditions.push(sql`TO_CHAR(${quotations.quotationDate}, 'YYYY-MM-DD') <= ${endDateStr}`);
      }

      if (status) {
        conditions.push(eq(quotations.status, status));
      }

      const result = await db.select().from(quotations).where(and(...conditions));
      console.log(`Found ${result.length} quotations in date range`);
      
      if (result.length > 0) {
        console.log('Sample quotation dates:');
        result.slice(0, 3).forEach(q => {
          console.log(`- ${q.brokerName}: ${new Date(q.quotationDate).toISOString()}`);
        });
      }
      
      return result;
    } catch (error) {
      console.error('Error in listQuotationsInDateRange:', error);
      throw error;
    }
  }

  async listOrdersInDateRange(
    userId: number,
    startDate?: Date,
    endDate?: Date,
    status?: string,
    includeAll: boolean = false
  ): Promise<Order[]> {
    try {
      const activeYear = await this.getActiveYear();
      console.log('listOrdersInDateRange called with dates:', {
        startDate: startDate?.toISOString(),
        endDate: endDate?.toISOString(),
        status,
        includeAll,
        activeYear
      });

      // Build all conditions as an array and combine with AND
      const conditions: any[] = [eq(orders.year, activeYear)];

      // Build clean start/end date filters using raw SQL for date comparison
      if (startDate && endDate) {
        const startDateStr = startDate.toISOString().split('T')[0];
        const endDateStr = endDate.toISOString().split('T')[0];
        console.log(`Using date range: ${startDateStr} to ${endDateStr}`);
        conditions.push(sql`TO_CHAR(${orders.orderDate}, 'YYYY-MM-DD') BETWEEN ${startDateStr} AND ${endDateStr}`);
      } else if (startDate) {
        const startDateStr = startDate.toISOString().split('T')[0];
        console.log(`Using start date: ${startDateStr}`);
        conditions.push(sql`TO_CHAR(${orders.orderDate}, 'YYYY-MM-DD') >= ${startDateStr}`);
      } else if (endDate) {
        const endDateStr = endDate.toISOString().split('T')[0];
        console.log(`Using end date: ${endDateStr}`);
        conditions.push(sql`TO_CHAR(${orders.orderDate}, 'YYYY-MM-DD') <= ${endDateStr}`);
      }

      // Status filtering logic
      if (!includeAll) {
        if (status) {
          if (status === "Policy Issued") {
            conditions.push(sql`${orders.statuses} && ARRAY['Policy Issued']::text[]`);
          } else {
            conditions.push(sql`NOT (${orders.statuses} && ARRAY['Policy Issued']::text[])`);
            conditions.push(sql`${orders.statuses} && ARRAY[${status}]::text[]`);
          }
        } else {
          conditions.push(sql`NOT (${orders.statuses} && ARRAY['Policy Issued']::text[])`);
        }
      }

      const result = await db.select().from(orders).where(and(...conditions));
      console.log(`Found ${result.length} orders in date range`);
      
      if (result.length > 0) {
        console.log('Sample order dates:');
        result.slice(0, 3).forEach(o => {
          console.log(`- ${o.brokerName}: ${new Date(o.orderDate).toISOString()}`);
        });
      }
      
      return result;
    } catch (error) {
      console.error('Error in listOrdersInDateRange:', error);
      throw error;
    }
  }

  // Liability & Financial Methods
  async createLiabilityQuotation(
    data: InsertLiabilityQuotation,
    userId: number
  ): Promise<LiabilityQuotation> {
    const activeYear = await this.getActiveYear();
    const result = await db
      .insert(liabilityQuotations)
      .values({ ...data, userId, year: activeYear })
      .returning();
    
    const quotation = result[0];
    if (data.status === "Confirmed") {
      await this.createLiabilityFirmOrderFromQuotation(quotation);
    }
    
    return quotation;
  }

  async listLiabilityQuotations(userId: number): Promise<LiabilityQuotation[]> {
    const activeYear = await this.getActiveYear();
    return db.select().from(liabilityQuotations).where(eq(liabilityQuotations.year, activeYear));
  }

  async listLiabilityQuotationsInDateRange(
    userId: number,
    startDate?: Date,
    endDate?: Date,
    status?: string
  ): Promise<LiabilityQuotation[]> {
    try {
      const activeYear = await this.getActiveYear();
      // Build all conditions as an array and combine with AND
      const conditions: any[] = [eq(liabilityQuotations.year, activeYear)];

      if (startDate && endDate) {
        const startDateStr = startDate.toISOString().split('T')[0];
        const endDateStr = endDate.toISOString().split('T')[0];
        conditions.push(sql`TO_CHAR(${liabilityQuotations.quotationDate}, 'YYYY-MM-DD') BETWEEN ${startDateStr} AND ${endDateStr}`);
      } else if (startDate) {
        const startDateStr = startDate.toISOString().split('T')[0];
        conditions.push(sql`TO_CHAR(${liabilityQuotations.quotationDate}, 'YYYY-MM-DD') >= ${startDateStr}`);
      } else if (endDate) {
        const endDateStr = endDate.toISOString().split('T')[0];
        conditions.push(sql`TO_CHAR(${liabilityQuotations.quotationDate}, 'YYYY-MM-DD') <= ${endDateStr}`);
      }

      if (status) {
        conditions.push(eq(liabilityQuotations.status, status));
      }

      const result = await db.select().from(liabilityQuotations).where(and(...conditions));
      return result;
    } catch (error) {
      console.error('Error in listLiabilityQuotationsInDateRange:', error);
      throw error;
    }
  }

  async getLiabilityQuotation(id: number): Promise<LiabilityQuotation | null> {
    const result = await db
      .select()
      .from(liabilityQuotations)
      .where(eq(liabilityQuotations.id, id));
    return result[0] || null;
  }

  async updateLiabilityQuotation(
    id: number,
    data: Partial<InsertLiabilityQuotation>
  ): Promise<LiabilityQuotation> {
    console.log('Updating liability quotation:', { id, data });
    
    const currentQuotation = await db
      .select()
      .from(liabilityQuotations)
      .where(eq(liabilityQuotations.id, id));

    console.log('Current quotation status:', currentQuotation[0]?.status);
    console.log('New status:', data.status);

    const result = await db
      .update(liabilityQuotations)
      .set({ ...data, lastUpdated: new Date() })
      .where(eq(liabilityQuotations.id, id))
      .returning();
    
    const quotation = result[0];
    if (currentQuotation[0] &&
      currentQuotation[0].status !== "Confirmed" &&
      data.status === "Confirmed") {
      console.log('Status changed to Confirmed, creating firm order...');
      await this.createLiabilityFirmOrderFromQuotation(quotation);
    }
    
    return quotation;
  }

  async deleteLiabilityQuotation(id: number): Promise<void> {
    await db.delete(liabilityQuotations).where(eq(liabilityQuotations.id, id));
  }

  async createLiabilityOrder(
    data: InsertLiabilityOrder,
    userId: number
  ): Promise<LiabilityOrder> {
    const activeYear = await this.getActiveYear();
    const result = await db
      .insert(liabilityOrders)
      .values({ ...data, userId, year: activeYear })
      .returning();
    return result[0];
  }

  async listLiabilityOrders(userId: number): Promise<LiabilityOrder[]> {
    const activeYear = await this.getActiveYear();
    const result = await db
      .select()
      .from(liabilityOrders)
      .where(and(
        eq(liabilityOrders.year, activeYear),
        sql`NOT (${liabilityOrders.statuses} && ARRAY['Policy Issued']::text[])`
      ));
    return result;
  }

  async listLiabilityOrdersInDateRange(
    userId: number,
    startDate?: Date,
    endDate?: Date,
    status?: string,
    includeAll: boolean = false
  ): Promise<LiabilityOrder[]> {
    try {
      const activeYear = await this.getActiveYear();
      // Build all conditions as an array and combine with AND
      const conditions: any[] = [eq(liabilityOrders.year, activeYear)];

      if (startDate && endDate) {
        const startDateStr = startDate.toISOString().split('T')[0];
        const endDateStr = endDate.toISOString().split('T')[0];
        conditions.push(sql`TO_CHAR(${liabilityOrders.orderDate}, 'YYYY-MM-DD') BETWEEN ${startDateStr} AND ${endDateStr}`);
      } else if (startDate) {
        const startDateStr = startDate.toISOString().split('T')[0];
        conditions.push(sql`TO_CHAR(${liabilityOrders.orderDate}, 'YYYY-MM-DD') >= ${startDateStr}`);
      } else if (endDate) {
        const endDateStr = endDate.toISOString().split('T')[0];
        conditions.push(sql`TO_CHAR(${liabilityOrders.orderDate}, 'YYYY-MM-DD') <= ${endDateStr}`);
      }

      // Status filtering logic
      if (!includeAll) {
        if (status) {
          if (status === "Policy Issued") {
            conditions.push(sql`${liabilityOrders.statuses} && ARRAY['Policy Issued']::text[]`);
          } else {
            conditions.push(sql`NOT (${liabilityOrders.statuses} && ARRAY['Policy Issued']::text[])`);
            conditions.push(sql`${liabilityOrders.statuses} && ARRAY[${status}]::text[]`);
          }
        } else {
          conditions.push(sql`NOT (${liabilityOrders.statuses} && ARRAY['Policy Issued']::text[])`);
        }
      }

      const result = await db.select().from(liabilityOrders).where(and(...conditions));
      return result;
    } catch (error) {
      console.error('Error in listLiabilityOrdersInDateRange:', error);
      throw error;
    }
  }

  async getLiabilityOrder(id: number): Promise<LiabilityOrder | null> {
    const result = await db
      .select()
      .from(liabilityOrders)
      .where(eq(liabilityOrders.id, id));
    return result[0] || null;
  }

  async updateLiabilityOrder(
    id: number,
    data: Partial<InsertLiabilityOrder>
  ): Promise<LiabilityOrder> {
    const result = await db
      .update(liabilityOrders)
      .set({ ...data, lastUpdated: new Date() })
      .where(eq(liabilityOrders.id, id))
      .returning();
    return result[0];
  }

  async deleteLiabilityOrder(id: number): Promise<void> {
    await db.delete(liabilityOrders).where(eq(liabilityOrders.id, id));
  }

  async createLiabilityFirmOrderFromQuotation(quotation: LiabilityQuotation): Promise<LiabilityOrder> {
    try {
      const activeYear = await this.getActiveYear();
      console.log('Creating liability order from quotation:', {
        quotationId: quotation.id,
        brokerName: quotation.brokerName,
        insuredName: quotation.insuredName,
        productType: quotation.productType,
        premium: quotation.estimatedPremium,
        currency: quotation.currency,
        userId: quotation.userId,
        year: activeYear
      });

      const result = await db.insert(liabilityOrders).values({
        brokerName: quotation.brokerName,
        insuredName: quotation.insuredName,
        productType: quotation.productType,
        businessType: "New Business",
        premium: quotation.estimatedPremium,
        currency: quotation.currency,
        orderDate: new Date().toISOString().split('T')[0], // Format as date string for PostgreSQL date type
        statuses: ["Firm Order Received", "KYC Pending"],
        notes: quotation.notes || null,
        userId: quotation.userId,
        year: activeYear,
      }).returning();

      console.log('Liability order created successfully:', result[0]);
      return result[0];
    } catch (error) {
      console.error('Error creating liability order from quotation:', error);
      throw error;
    }
  }
}

export const storage = new DatabaseStorage();
