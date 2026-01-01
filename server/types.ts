import session from "express-session";
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
  UpdatePropertyEngineeringOrder
} from "@shared/schema";

export interface IStorage {
  sessionStore: session.Store;

  // User methods
  getUser(id: number): Promise<User | undefined>;
  getUserByUsername(username: string): Promise<User | undefined>;
  createUser(user: InsertUser): Promise<User>;

  // Marine Order methods
  createOrder(insertOrder: InsertOrder, userId: number): Promise<Order>;
  updateOrder(id: number, updateOrder: UpdateOrder): Promise<Order>;
  getOrder(id: number): Promise<Order | undefined>;
  listOrders(userId: number): Promise<Order[]>;
  listOrdersInDateRange(userId: number, startDate?: Date, endDate?: Date, status?: string, includeAll?: boolean): Promise<Order[]>;
  deleteOrder(id: number): Promise<void>;

  // Property & Engineering Order methods
  createPropertyEngineeringOrder(insertOrder: InsertPropertyEngineeringOrder, userId: number): Promise<PropertyEngineeringOrder>;
  updatePropertyEngineeringOrder(id: number, updateOrder: UpdatePropertyEngineeringOrder): Promise<PropertyEngineeringOrder>;
  getPropertyEngineeringOrder(id: number): Promise<PropertyEngineeringOrder | undefined>;
  listPropertyEngineeringOrders(userId: number): Promise<PropertyEngineeringOrder[]>;
  listPropertyEngineeringOrdersInDateRange(userId: number, startDate?: Date, endDate?: Date, status?: string, includeAll?: boolean): Promise<PropertyEngineeringOrder[]>;
  deletePropertyEngineeringOrder(id: number): Promise<void>;

  // Marine Quotation methods
  createQuotation(insertQuotation: InsertQuotation, userId: number): Promise<Quotation>;
  updateQuotation(id: number, updateQuotation: InsertQuotation): Promise<Quotation>;
  getQuotation(id: number): Promise<Quotation | undefined>;
  listQuotations(userId: number): Promise<Quotation[]>;
  listQuotationsInDateRange(userId: number, startDate?: Date, endDate?: Date, status?: string): Promise<Quotation[]>;
  deleteQuotation(id: number): Promise<void>;

  // Property & Engineering Quotation methods
  createPropertyEngineeringQuotation(insertQuotation: InsertPropertyEngineeringQuotation, userId: number): Promise<PropertyEngineeringQuotation>;
  updatePropertyEngineeringQuotation(id: number, updateQuotation: InsertPropertyEngineeringQuotation): Promise<PropertyEngineeringQuotation>;
  getPropertyEngineeringQuotation(id: number): Promise<PropertyEngineeringQuotation | undefined>;
  listPropertyEngineeringQuotations(userId: number): Promise<PropertyEngineeringQuotation[]>;
  listPropertyEngineeringQuotationsInDateRange(userId: number, startDate?: Date, endDate?: Date, status?: string): Promise<PropertyEngineeringQuotation[]>;
  deletePropertyEngineeringQuotation(id: number): Promise<void>;

  // Status log methods
  createStatusLog(log: Omit<StatusLog, "id">): Promise<StatusLog>;
  createPropertyEngineeringStatusLog(log: Omit<PropertyEngineeringStatusLog, "id">): Promise<PropertyEngineeringStatusLog>;
  getOrderLogs(orderId: number): Promise<StatusLog[]>;
  getPropertyEngineeringOrderLogs(orderId: number): Promise<PropertyEngineeringStatusLog[]>;

  // AI suggestion methods
  updateOrderAISuggestion(orderId: number, suggestion: string): Promise<void>;
}