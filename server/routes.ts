import type { Express, Response, Request } from "express";
import { createServer, type Server } from "http";
import multer from "multer";
import { parsePDF } from "./utils/pdf";
import { storage } from "./storage";
import { setupAuth } from "./auth";
import {
  insertOrderSchema,
  insertQuotationSchema,
  updateOrderSchema,
  insertPropertyEngineeringOrderSchema,
  insertPropertyEngineeringQuotationSchema,
  updatePropertyEngineeringOrderSchema,
  insertLiabilityOrderSchema,
  insertLiabilityQuotationSchema,
} from "@shared/schema";
import XLSX from "xlsx";
import {
  analyzeQuotations,
  extractOrderDetailsFromQuotation,
  extractQuotationDetails,
} from "./openai";

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 },
});

async function readQuotationDocument(req: Request): Promise<string> {
  const file = (req as any).file as Express.Multer.File | undefined;
  const body = (req.body || {}) as Record<string, unknown>;
  const manualTextCandidate =
    typeof body.manualText === "string" && body.manualText.trim().length > 0
      ? body.manualText
      : typeof body.text === "string"
      ? body.text
      : undefined;

  if (!file && (!manualTextCandidate || manualTextCandidate.trim().length === 0)) {
    throw new Error("Quotation document is required");
  }

  let documentText = "";

  if (file) {
    documentText = await parsePDF(file.buffer, file.mimetype, file.originalname);
  } else if (typeof manualTextCandidate === "string") {
    documentText = manualTextCandidate;
  }

  if (!documentText || !documentText.trim()) {
    throw new Error("Unable to read quotation document");
  }

  return documentText.trim();
}

function mergeNotes(extractedNotes: string | null, manualNotes?: string): string {
  const extra = manualNotes?.trim();
  if (extractedNotes && extractedNotes.trim()) {
    return extra ? `${extractedNotes.trim()}\n${extra}` : extractedNotes.trim();
  }
  return extra || "";
}

function requireAuth(req: Request, res: Response, next: Function) {
  if (!req.isAuthenticated()) {
    res.status(401).json({ message: "Unauthorized" });
    return;
  }
  next();
}

function requireDepartment(department: string) {
  return (req: Request, res: Response, next: Function) => {
    if (!req.isAuthenticated()) {
      res.status(401).json({ message: "Unauthorized" });
      return;
    }
    
    if (req.user?.department !== department) {
      res.status(403).json({ message: `Access denied. This endpoint requires ${department} department access.` });
      return;
    }
    
    next();
  };
}

export function registerRoutes(app: Express): Server {
  setupAuth(app);

  // Marine Order management routes (Marine department only)
  app.post("/api/orders", requireDepartment("Marine"), async (req, res) => {
    console.log('Received order data:', req.body);
    const parseResult = insertOrderSchema.safeParse(req.body);
    if (!parseResult.success) {
      console.error('Order validation failed:', parseResult.error);
      res.status(400).json(parseResult.error);
      return;
    }

    const order = await storage.createOrder(parseResult.data, req.user!.id);
    res.status(201).json(order);
  });

  app.post(
    "/api/orders/upload",
    requireDepartment("Marine"),
    upload.single("quotation"),
    async (req, res) => {
      try {
        const documentText = await readQuotationDocument(req);
        const extracted = await extractOrderDetailsFromQuotation(documentText);

        const manualBrokerName =
          typeof req.body?.brokerName === "string" && req.body.brokerName.trim()
            ? req.body.brokerName.trim()
            : null;

        const brokerName = manualBrokerName ?? extracted.brokerName;
        if (!brokerName) {
          res.status(400).json({
            message:
              "Broker name not found. Please provide it manually when uploading the quotation.",
          });
          return;
        }

        // Use form-provided businessType and orderDate if available, otherwise fall back to extracted
        const formBusinessType = typeof req.body?.businessType === "string" && req.body.businessType.trim()
          ? req.body.businessType.trim()
          : null;
        const formOrderDate = typeof req.body?.orderDate === "string" && req.body.orderDate.trim()
          ? req.body.orderDate.trim()
          : null;

        const businessType = formBusinessType ?? extracted.businessType;
        const orderDate = formOrderDate ?? extracted.orderDateISO;

        let notes = mergeNotes(extracted.notes ?? "", req.body?.notes as string | undefined);
        if (
          (extracted.marineProductType === "Pleasure Boats" ||
            extracted.marineProductType === "Jetski") &&
          extracted.vesselName
        ) {
          const vesselLine = `Vessel: ${extracted.vesselName}`;
          notes = notes ? `${notes}\n${vesselLine}` : vesselLine;
        }

        const orderPayload = insertOrderSchema.parse({
          brokerName,
          insuredName: extracted.insuredName,
          marineProductType: extracted.marineProductType,
          businessType,
          premium: extracted.premium.toString(),
          currency: extracted.currency,
          orderDate,
          statuses: ["Firm Order Received", "KYC Pending"],
          notes,
          requiresPreConditionSurvey: extracted.requiresPreConditionSurvey,
        });

        const order = await storage.createOrder(orderPayload, req.user!.id);
        res.status(201).json(order);
      } catch (error) {
        console.error("Error processing quotation upload:", error);
        const message = error instanceof Error ? error.message : "Failed to process quotation";
        const statusCode =
          message.includes("required") || message.includes("extracted")
            ? 400
            : 500;
        res.status(statusCode).json({ message });
      }
    }
  );

  app.post(
    "/api/quotations/extract",
    requireDepartment("Marine"),
    upload.single("quotation"),
    async (req, res) => {
      try {
        const documentText = await readQuotationDocument(req);
        const extracted = await extractQuotationDetails(documentText);

        const manualBrokerName =
          typeof req.body?.brokerName === "string" && req.body.brokerName.trim()
            ? req.body.brokerName.trim()
            : null;

        const brokerName = manualBrokerName ?? extracted.brokerName ?? null;

        let notes = mergeNotes(extracted.notes ?? "", req.body?.notes as string | undefined);
        if (
          (extracted.marineProductType === "Pleasure Boats" ||
            extracted.marineProductType === "Jetski") &&
          extracted.vesselName
        ) {
          const vesselLine = `Vessel: ${extracted.vesselName}`;
          notes = notes ? `${notes}\n${vesselLine}` : vesselLine;
        }

        res.json({
          brokerName,
          insuredName: extracted.insuredName,
          marineProductType: extracted.marineProductType,
          estimatedPremium: extracted.estimatedPremium,
          currency: extracted.currency,
          quotationDate: extracted.quotationDateISO,
          status: extracted.status,
          declineReason: extracted.declineReason,
          notes,
          requiresPreConditionSurvey: extracted.requiresPreConditionSurvey,
        });
      } catch (error) {
        console.error("Error extracting quotation:", error);
        const message = error instanceof Error ? error.message : "Failed to extract quotation";
        const statusCode =
          message.includes("required") ||
          message.includes("extracted") ||
          message.includes("Insured")
            ? 400
            : 500;
        res.status(statusCode).json({ message });
      }
    }
  );

  app.get("/api/orders", requireDepartment("Marine"), async (req, res) => {
    const { status, startDate, endDate, includeAll } = req.query;

    try {
      const parsedStartDate = startDate ? new Date(startDate as string) : undefined;
      const parsedEndDate = endDate ? new Date(endDate as string) : undefined;

      // If includeAll is true, skip status filtering to get total count
      const orders = await storage.listOrdersInDateRange(
        req.user!.id,
        parsedStartDate,
        parsedEndDate,
        includeAll === "true" ? undefined : status as string,
        includeAll === "true"
      );
      res.json(orders);
    } catch (error) {
      console.error('Error fetching orders:', error);
      res.status(500).json({ message: "Failed to fetch orders" });
    }
  });

  app.get("/api/orders/:id", requireDepartment("Marine"), async (req, res) => {
    const order = await storage.getOrder(parseInt(req.params.id));
    if (!order) {
      res.status(404).json({ message: "Order not found" });
      return;
    }
    res.json(order);
  });

  app.put("/api/orders/:id", requireDepartment("Marine"), async (req, res) => {
    console.log('Updating order:', req.params.id, req.body);
    const parseResult = updateOrderSchema.safeParse(req.body);
    if (!parseResult.success) {
      console.error('Order update validation failed:', parseResult.error);
      res.status(400).json(parseResult.error);
      return;
    }

    try {
      // Get the current order to check for status change
      const currentOrder = await storage.getOrder(parseInt(req.params.id));
      if (!currentOrder) {
        res.status(404).json({ message: "Order not found" });
        return;
      }

      const updatedOrder = await storage.updateOrder(
        parseInt(req.params.id),
        parseResult.data,
      );

      // Check if the order was moved to "Policy Issued" status
      const hasMovedToClosed = !currentOrder.statuses.includes("Policy Issued") &&
        parseResult.data.statuses?.includes("Policy Issued");

      res.json({
        order: updatedOrder,
        hasMovedToClosed,
      });
    } catch (error) {
      console.error('Error updating order:', error);
      res.status(500).json({ message: "Failed to update order" });
    }
  });

  app.delete("/api/orders/:id", requireDepartment("Marine"), async (req, res) => {
    const order = await storage.getOrder(parseInt(req.params.id));
    if (!order) {
      res.status(404).json({ message: "Order not found" });
      return;
    }

    await storage.deleteOrder(parseInt(req.params.id));
    res.sendStatus(200);
  });

  // Marine quotation management routes (Marine department only)
  app.post("/api/quotations", requireDepartment("Marine"), async (req, res) => {
    console.log('Received quotation data:', req.body);
    const parseResult = insertQuotationSchema.safeParse(req.body);
    if (!parseResult.success) {
      console.error('Quotation validation failed:', parseResult.error);
      res.status(400).json(parseResult.error);
      return;
    }

    const quotation = await storage.createQuotation(parseResult.data, req.user!.id);
    res.status(201).json(quotation);
  });

  app.get("/api/quotations", requireDepartment("Marine"), async (req, res) => {
    const { startDate, endDate } = req.query;
    
    try {
      let quotations;
      
      if (startDate || endDate) {
        console.log('Fetching quotations with date range:', { startDate, endDate });
        
        // Parse dates with proper validation
        let parsedStartDate: Date | undefined;
        let parsedEndDate: Date | undefined;

        if (startDate && typeof startDate === 'string') {
          parsedStartDate = new Date(startDate);
          if (isNaN(parsedStartDate.getTime())) {
            return res.status(400).json({ message: "Invalid start date format" });
          }
          console.log('Parsed start date:', parsedStartDate.toISOString());
        }

        if (endDate && typeof endDate === 'string') {
          parsedEndDate = new Date(endDate);
          if (isNaN(parsedEndDate.getTime())) {
            return res.status(400).json({ message: "Invalid end date format" });
          }
          console.log('Parsed end date:', parsedEndDate.toISOString());
        }
        
        quotations = await storage.listQuotationsInDateRange(
          req.user!.id,
          parsedStartDate,
          parsedEndDate,
          undefined
        );
      } else {
        quotations = await storage.listQuotations(req.user!.id);
      }
      
      res.json(quotations);
    } catch (error) {
      console.error('Error fetching quotations:', error);
      res.status(500).json({ message: "Failed to fetch quotations" });
    }
  });

  // Update the export route to handle 'all' quotations
  app.get("/api/quotations/export/:status?", requireDepartment("Marine"), async (req, res) => {
    const { startDate, endDate, ids } = req.query;
    const status = req.params.status;

    try {
      console.log('Export request with dates and status:', { startDate, endDate, status, ids });

      const parsedStartDate = startDate ? new Date(startDate as string) : undefined;
      const parsedEndDate = endDate ? new Date(endDate as string) : undefined;

      console.log('Parsed dates:', { parsedStartDate, parsedEndDate });

      const quotations = await storage.listQuotationsInDateRange(
        req.user!.id,
        parsedStartDate,
        parsedEndDate,
        status === 'selected' ? undefined : status
      );

      console.log(`Found ${quotations.length} quotations matching criteria`);

      // Filter by IDs if provided (for selected items export)
      let filteredQuotations = quotations;
      if (status === 'selected' && ids && Array.isArray(ids)) {
        const selectedIds = (ids as string[]).map(id => parseInt(id));
        filteredQuotations = quotations.filter(quote => selectedIds.includes(quote.id));
      }

      console.log(`After filtering: ${filteredQuotations.length} quotations`);

      const csvData = filteredQuotations.map(quote => ({
        "Broker Name": quote.brokerName,
        "Insured Name": quote.insuredName,
        "Marine Product Type": quote.marineProductType,
        "Estimated Premium": `${parseFloat(quote.estimatedPremium.toString()).toFixed(2)} ${quote.currency}`,
        "Quotation Date": new Date(quote.quotationDate).toLocaleDateString('en-GB'),
        "Status": quote.status,
        "Decline Reason": quote.declineReason || "",
        "Notes": quote.notes || "",
        "Last Updated": new Date(quote.lastUpdated).toLocaleDateString('en-GB')
      }));

      const worksheet = XLSX.utils.json_to_sheet(csvData);
      const csvContent = XLSX.utils.sheet_to_csv(worksheet);

      // Set a more descriptive filename based on status and date range
      const statusText = status === 'selected' ? '_selected' : status ? `-${status}` : '';
      const dateRangeText = startDate ?
        `_${new Date(startDate as string).toLocaleDateString('en-GB')}${
          endDate ? `_to_${new Date(endDate as string).toLocaleDateString('en-GB')}` : ''
        }` : '';

      res.setHeader("Content-Type", "text/csv");
      res.setHeader(
        "Content-Disposition",
        `attachment; filename=quotations${statusText}${dateRangeText}.csv`
      );
      res.send(csvContent);
    } catch (error) {
      console.error('Error exporting quotations:', error);
      res.status(500).json({ message: "Failed to export quotations" });
    }
  });

  // Move export route before id-specific routes
  app.get("/api/quotations/analyze", requireAuth, async (req, res) => {
    const { startDate, endDate, instructions } = req.query;

    try {
      console.log('Analysis request with dates:', {
        startDate,
        endDate
      });

      // Parse dates with proper validation
      let parsedStartDate: Date | undefined;
      let parsedEndDate: Date | undefined;

      if (startDate && typeof startDate === 'string') {
        parsedStartDate = new Date(startDate);
        if (isNaN(parsedStartDate.getTime())) {
          return res.status(400).json({ message: "Invalid start date format" });
        }
        // No need to modify the time - the client has already set it correctly
        console.log('Parsed start date for analysis:', parsedStartDate.toISOString(), '(local date:', new Date(startDate).toLocaleDateString(), ')');
      }

      if (endDate && typeof endDate === 'string') {
        parsedEndDate = new Date(endDate);
        if (isNaN(parsedEndDate.getTime())) {
          return res.status(400).json({ message: "Invalid end date format" });
        }
        // No need to modify the time - the client has already set it correctly
        console.log('Parsed end date for analysis:', parsedEndDate.toISOString(), '(local date:', new Date(endDate).toLocaleDateString(), ')');
      }

      console.log('Analysis request with parsed dates:', {
        parsedStartDate: parsedStartDate?.toISOString(),
        parsedEndDate: parsedEndDate?.toISOString()
      });

      // Validate date range
      if (parsedStartDate && parsedEndDate && parsedStartDate > parsedEndDate) {
        return res.status(400).json({ message: "Start date cannot be after end date" });
      }

      // Fetch quotations first using strict date filtering
      const quotations = await storage.listQuotationsInDateRange(
        req.user!.id,
        parsedStartDate,
        parsedEndDate,
        undefined // Don't filter by status for analysis
      );

      // Then fetch orders for the same period using strict date filtering
      const orders = await storage.listOrdersInDateRange(
        req.user!.id,
        parsedStartDate,
        parsedEndDate,
        undefined, // Don't filter by status
        true // Include all orders
      );

      console.log(`Found ${quotations.length} quotations for analysis in date range ${parsedStartDate?.toISOString() || 'all time'} to ${parsedEndDate?.toISOString() || 'present'}`);
      console.log(`Found ${orders.length} orders for analysis in the same period`);

      if (quotations.length === 0 && orders.length === 0) {
        return res.status(404).json({ message: "No data found in the specified date range" });
      }

      // Log status counts before analysis
      const statusCounts = {
        Open: quotations.filter(q => q.status === 'Open').length,
        Confirmed: quotations.filter(q => q.status === 'Confirmed').length,
        Decline: quotations.filter(q => q.status === 'Decline').length,
        Total: quotations.length
      };
      
      console.log('Quotations to be analyzed:', statusCounts);

      // Convert estimatedPremium to number before passing to analysis
      const preparedQuotations = quotations.map(q => ({
        ...q,
        estimatedPremium: parseFloat(q.estimatedPremium.toString())
      }));

      // Prepare orders data, including business type information
      const preparedOrders = orders.map(o => ({
        ...o,
        premium: parseFloat(o.premium.toString())
      }));

      console.log(`Sending ${preparedQuotations.length} quotations to OpenAI for analysis`);
      const analysis = await analyzeQuotations(
        preparedQuotations, 
        preparedOrders,
        parsedStartDate || parsedEndDate ? {
          startDate: parsedStartDate,
          endDate: parsedEndDate
        } : undefined,
        typeof instructions === 'string' ? instructions : undefined
      );
      res.json({ analysis });
    } catch (error) {
      console.error('Error analyzing data:', error);
      res.status(500).json({
        message: "Failed to analyze data",
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  });

  // Then define the id-specific routes
  app.get("/api/quotations/:id", requireDepartment("Marine"), async (req, res) => {
    const quotation = await storage.getQuotation(parseInt(req.params.id));
    if (!quotation) {
      res.status(404).json({ message: "Quotation not found" });
      return;
    }
    res.json(quotation);
  });

  app.put("/api/quotations/:id", requireDepartment("Marine"), async (req, res) => {
    console.log('Updating quotation:', req.params.id, req.body);
    const parseResult = insertQuotationSchema.safeParse(req.body);
    if (!parseResult.success) {
      console.error('Quotation update validation failed:', parseResult.error);
      res.status(400).json(parseResult.error);
      return;
    }

    try {
      const updatedQuotation = await storage.updateQuotation(
        parseInt(req.params.id),
        parseResult.data,
      );
      res.json(updatedQuotation);
    } catch (error) {
      console.error('Error updating quotation:', error);
      res.status(500).json({ message: "Failed to update quotation" });
    }
  });

  app.delete("/api/quotations/:id", requireDepartment("Marine"), async (req, res) => {
    const quotation = await storage.getQuotation(parseInt(req.params.id));
    if (!quotation) {
      res.status(404).json({ message: "Quotation not found" });
      return;
    }

    await storage.deleteQuotation(parseInt(req.params.id));
    res.sendStatus(200);
  });

  // Property & Engineering Order management routes (Property & Engineering department only)
  app.post("/api/property-engineering/orders", requireDepartment("Property & Engineering"), async (req, res) => {
    console.log('Received Property & Engineering order data:', req.body);
    const parseResult = insertPropertyEngineeringOrderSchema.safeParse(req.body);
    if (!parseResult.success) {
      console.error('Property & Engineering order validation failed:', parseResult.error);
      res.status(400).json(parseResult.error);
      return;
    }

    const order = await storage.createPropertyEngineeringOrder(parseResult.data, req.user!.id);
    res.status(201).json(order);
  });

  app.get("/api/property-engineering/orders", requireDepartment("Property & Engineering"), async (req, res) => {
    try {
      const { startDate, endDate, status, includeAll } = req.query;
      
      if (status || startDate || endDate || includeAll) {
        // Use the date range method for filtered queries or when includeAll is specified
        const parsedStartDate = startDate ? new Date(startDate as string) : undefined;
        const parsedEndDate = endDate ? new Date(endDate as string) : undefined;
        
        const orders = await storage.listPropertyEngineeringOrdersInDateRange(
          req.user!.id,
          parsedStartDate,
          parsedEndDate,
          status as string | undefined,
          includeAll === 'true' // Pass includeAll parameter
        );
        res.json(orders);
      } else {
        // Use the regular method for unfiltered queries
        const orders = await storage.listPropertyEngineeringOrders(req.user!.id);
        res.json(orders);
      }
    } catch (error) {
      console.error('Error fetching Property & Engineering orders:', error);
      res.status(500).json({ message: "Failed to fetch Property & Engineering orders" });
    }
  });

  app.get("/api/property-engineering/orders/:id", requireDepartment("Property & Engineering"), async (req, res) => {
    const order = await storage.getPropertyEngineeringOrder(parseInt(req.params.id));
    if (!order) {
      res.status(404).json({ message: "Property & Engineering order not found" });
      return;
    }
    res.json(order);
  });

  app.put("/api/property-engineering/orders/:id", requireDepartment("Property & Engineering"), async (req, res) => {
    console.log('Updating Property & Engineering order:', req.params.id, req.body);
    const parseResult = updatePropertyEngineeringOrderSchema.safeParse(req.body);
    if (!parseResult.success) {
      console.error('Property & Engineering order update validation failed:', parseResult.error);
      res.status(400).json(parseResult.error);
      return;
    }

    try {
      const updatedOrder = await storage.updatePropertyEngineeringOrder(
        parseInt(req.params.id),
        parseResult.data,
      );

      res.json({ order: updatedOrder });
    } catch (error) {
      console.error('Error updating Property & Engineering order:', error);
      res.status(500).json({ message: "Failed to update Property & Engineering order" });
    }
  });

  app.delete("/api/property-engineering/orders/:id", requireDepartment("Property & Engineering"), async (req, res) => {
    const order = await storage.getPropertyEngineeringOrder(parseInt(req.params.id));
    if (!order) {
      res.status(404).json({ message: "Property & Engineering order not found" });
      return;
    }

    await storage.deletePropertyEngineeringOrder(parseInt(req.params.id));
    res.sendStatus(200);
  });

  // Property & Engineering Quotation management routes (Property & Engineering department only)
  app.post("/api/property-engineering/quotations", requireDepartment("Property & Engineering"), async (req, res) => {
    console.log('Received Property & Engineering quotation data:', req.body);
    const parseResult = insertPropertyEngineeringQuotationSchema.safeParse(req.body);
    if (!parseResult.success) {
      console.error('Property & Engineering quotation validation failed:', parseResult.error);
      res.status(400).json(parseResult.error);
      return;
    }

    const quotation = await storage.createPropertyEngineeringQuotation(parseResult.data, req.user!.id);
    res.status(201).json(quotation);
  });

  app.get("/api/property-engineering/quotations", requireDepartment("Property & Engineering"), async (req, res) => {
    try {
      const quotations = await storage.listPropertyEngineeringQuotations(req.user!.id);
      res.json(quotations);
    } catch (error) {
      console.error('Error fetching Property & Engineering quotations:', error);
      res.status(500).json({ message: "Failed to fetch Property & Engineering quotations" });
    }
  });

  app.get("/api/property-engineering/quotations/:id", requireDepartment("Property & Engineering"), async (req, res) => {
    const quotation = await storage.getPropertyEngineeringQuotation(parseInt(req.params.id));
    if (!quotation) {
      res.status(404).json({ message: "Property & Engineering quotation not found" });
      return;
    }
    res.json(quotation);
  });

  app.put("/api/property-engineering/quotations/:id", requireDepartment("Property & Engineering"), async (req, res) => {
    console.log('Updating Property & Engineering quotation:', req.params.id, req.body);
    const parseResult = insertPropertyEngineeringQuotationSchema.safeParse(req.body);
    if (!parseResult.success) {
      console.error('Property & Engineering quotation update validation failed:', parseResult.error);
      res.status(400).json(parseResult.error);
      return;
    }

    try {
      const updatedQuotation = await storage.updatePropertyEngineeringQuotation(
        parseInt(req.params.id),
        parseResult.data,
      );
      res.json(updatedQuotation);
    } catch (error) {
      console.error('Error updating Property & Engineering quotation:', error);
      res.status(500).json({ message: "Failed to update Property & Engineering quotation" });
    }
  });

  app.delete("/api/property-engineering/quotations/:id", requireDepartment("Property & Engineering"), async (req, res) => {
    const quotation = await storage.getPropertyEngineeringQuotation(parseInt(req.params.id));
    if (!quotation) {
      res.status(404).json({ message: "Property & Engineering quotation not found" });
      return;
    }

    await storage.deletePropertyEngineeringQuotation(parseInt(req.params.id));
    res.sendStatus(200);
  });

  // Property & Engineering Export routes
  app.get("/api/property-engineering/orders/export/:status", requireDepartment("Property & Engineering"), async (req, res) => {
    const { startDate, endDate, businessType, ids } = req.query;
    const { status } = req.params;
    console.log('P&E Export request:', { startDate, endDate, businessType, ids, status });

    try {
      const parsedStartDate = startDate ? new Date(startDate as string) : undefined;
      const parsedEndDate = endDate ? new Date(endDate as string) : undefined;

      const orders = await storage.listPropertyEngineeringOrders(req.user!.id);

      // Apply filters
      let filteredOrders = orders;
      
      // Status filter (unless exporting "all" or "selected")
      if (status !== 'all' && status !== 'selected') {
        filteredOrders = filteredOrders.filter(order => order.statuses.includes(status));
      }
      
      // Date filter
      if (parsedStartDate || parsedEndDate) {
        filteredOrders = filteredOrders.filter(order => {
          const orderDate = new Date(order.orderDate);
          const matchesStart = !parsedStartDate || orderDate >= parsedStartDate;
          const matchesEnd = !parsedEndDate || orderDate <= parsedEndDate;
          return matchesStart && matchesEnd;
        });
      }

      // Business type filter
      if (businessType && businessType !== 'all') {
        filteredOrders = filteredOrders.filter(order => order.businessType === businessType);
      }

      // IDs filter (for selected items export)
      if (status === 'selected' && ids && Array.isArray(ids)) {
        const selectedIds = (ids as string[]).map(id => parseInt(id));
        filteredOrders = filteredOrders.filter(order => selectedIds.includes(order.id));
      }

      console.log(`Exporting ${filteredOrders.length} P&E orders`);

      const workbook = XLSX.utils.book_new();
      const worksheet = XLSX.utils.json_to_sheet(
        filteredOrders.map(order => ({
          "Broker Name": order.brokerName,
          "Insured Name": order.insuredName,
          "Product Type": order.productType,
          "Cover Group": order.coverGroup,
          "Business Type": order.businessType,
          "Premium": `${parseFloat(order.premium.toString()).toFixed(2)} ${order.currency}`,
          "Order Date": new Date(order.orderDate).toLocaleDateString('en-GB'),
          "Statuses": order.statuses.join(", "),
          "Pre-condition Survey": order.requiresPreConditionSurvey ? "Yes" : "No",
          "Notes": order.notes || "",
          "Last Updated": new Date(order.lastUpdated).toLocaleDateString('en-GB')
        }))
      );

      XLSX.utils.book_append_sheet(workbook, worksheet, "P&E Orders");
      const excelBuffer = XLSX.write(workbook, { type: "buffer", bookType: "xlsx" });

      res.setHeader(
        "Content-Type",
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
      );
      res.setHeader(
        "Content-Disposition",
        `attachment; filename=property_engineering_orders_${status}_${new Date().toISOString().split('T')[0]}.xlsx`
      );
      res.send(excelBuffer);
    } catch (error) {
      console.error('Error exporting P&E orders:', error);
      res.status(500).json({ message: "Failed to export orders" });
    }
  });

  app.get("/api/property-engineering/quotations/export/:status", requireDepartment("Property & Engineering"), async (req, res) => {
    const { startDate, endDate, ids } = req.query;
    const { status } = req.params;
    console.log('P&E Quotations Export request:', { startDate, endDate, ids, status });

    try {
      const parsedStartDate = startDate ? new Date(startDate as string) : undefined;
      const parsedEndDate = endDate ? new Date(endDate as string) : undefined;

      const quotations = await storage.listPropertyEngineeringQuotations(req.user!.id);

      // Apply filters
      let filteredQuotations = quotations;
      
      // Status filter (unless exporting "all" or "selected")
      if (status !== 'all' && status !== 'selected') {
        filteredQuotations = filteredQuotations.filter(quotation => quotation.status === status);
      }
      
      // Date filter
      if (parsedStartDate || parsedEndDate) {
        filteredQuotations = filteredQuotations.filter(quotation => {
          const quotationDate = new Date(quotation.quotationDate);
          const matchesStart = !parsedStartDate || quotationDate >= parsedStartDate;
          const matchesEnd = !parsedEndDate || quotationDate <= parsedEndDate;
          return matchesStart && matchesEnd;
        });
      }

      // IDs filter (for selected items export)
      if (status === 'selected' && ids && Array.isArray(ids)) {
        const selectedIds = (ids as string[]).map(id => parseInt(id));
        filteredQuotations = filteredQuotations.filter(quotation => selectedIds.includes(quotation.id));
      }

      console.log(`Exporting ${filteredQuotations.length} P&E quotations`);

      // Create CSV data
      const csvData = [
        ["Broker Name", "Insured Name", "Product Type", "Cover Group", "Estimated Premium", "Currency", "Quotation Date", "Status", "Decline Reason", "Pre-condition Survey", "Notes", "Last Updated"],
        ...filteredQuotations.map(quotation => [
          quotation.brokerName,
          quotation.insuredName,
          quotation.productType,
          quotation.coverGroup,
          parseFloat(quotation.estimatedPremium.toString()).toFixed(2),
          quotation.currency,
          new Date(quotation.quotationDate).toLocaleDateString('en-GB'),
          quotation.status,
          quotation.declineReason || "",
          quotation.requiresPreConditionSurvey ? "Yes" : "No",
          quotation.notes || "",
          new Date(quotation.lastUpdated).toLocaleDateString('en-GB')
        ])
      ];

      // Convert to CSV string
      const csvContent = csvData.map(row => 
        row.map(cell => `"${String(cell).replace(/"/g, '""')}"`).join(',')
      ).join('\n');

      res.setHeader("Content-Type", "text/csv");
      res.setHeader(
        "Content-Disposition",
        `attachment; filename=property_engineering_quotations_${status}_${new Date().toISOString().split('T')[0]}.csv`
      );
      res.send(csvContent);
    } catch (error) {
      console.error('Error exporting P&E quotations:', error);
      res.status(500).json({ message: "Failed to export quotations" });
    }
  });

  // Fallback routes for backward compatibility
  app.get("/api/property-engineering/orders/export", requireDepartment("Property & Engineering"), async (req, res) => {
    req.params.status = 'all';
    return app._router.handle(req, res);
  });

  app.get("/api/property-engineering/quotations/export", requireDepartment("Property & Engineering"), async (req, res) => {
    req.params.status = 'all';
    return app._router.handle(req, res);
  });

  // Export routes
  app.get("/api/orders/export/:status", requireDepartment("Marine"), async (req, res) => {
    const { startDate, endDate, businessType, ids } = req.query;
    console.log('Export request with dates:', { startDate, endDate, status: req.params.status, businessType, ids });

    try {
      const parsedStartDate = startDate ? new Date(startDate as string) : undefined;
      const parsedEndDate = endDate ? new Date(endDate as string) : undefined;

      console.log('Parsed dates:', { parsedStartDate, parsedEndDate });

      // If businessType is specified, use includeAll=true to get both firm orders and closed policies
      const status = businessType ? undefined : req.params.status;
      const includeAll = Boolean(businessType);

      const orders = await storage.listOrdersInDateRange(
        req.user!.id,
        parsedStartDate,
        parsedEndDate,
        status === 'selected' ? undefined : status,
        includeAll // This will fetch both firm orders and closed policies when true
      );

      console.log(`Found ${orders.length} orders matching criteria`);

      // Filter by IDs if provided (for selected items export)
      let filteredOrders = orders;
      if (ids && Array.isArray(ids)) {
        const selectedIds = (ids as string[]).map(id => parseInt(id));
        filteredOrders = orders.filter(order => selectedIds.includes(order.id));
      }
      // Filter by business type if specified
      if (businessType) {
        filteredOrders = filteredOrders.filter(order => order.businessType === businessType);
      }

      console.log(`After filtering: ${filteredOrders.length} orders`);

      const workbook = XLSX.utils.book_new();
      const worksheet = XLSX.utils.json_to_sheet(
        filteredOrders.map(order => ({
          "Broker Name": order.brokerName,
          "Insured Name": order.insuredName,
          "Marine Product Type": order.marineProductType,
          "Business Type": order.businessType,
          "Premium": `${parseFloat(order.premium.toString()).toFixed(2)} ${order.currency}`,
          "Order Date": new Date(order.orderDate).toLocaleDateString('en-GB'),
          "Statuses": order.statuses.join(", "),
          "Notes": order.notes || "",
          "Last Updated": new Date(order.lastUpdated).toLocaleDateString('en-GB')
        }))
      );

      XLSX.utils.book_append_sheet(workbook, worksheet, "Orders");
      const excelBuffer = XLSX.write(workbook, { type: "buffer", bookType: "xlsx" });

      // Update filename to reflect business type or selected items
      const filename = typeof businessType === 'string' 
        ? `orders_${businessType.replace(/\s+/g, '')}`
        : req.params.status === 'selected'
        ? 'orders_selected'
        : `orders_${req.params.status}`;

      const dateStr = startDate 
        ? `_${new Date(startDate as string).toLocaleDateString('en-GB')}${
            endDate ? `_to_${new Date(endDate as string).toLocaleDateString('en-GB')}` : ''
          }`
        : '';

      res.setHeader(
        "Content-Type",
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
      );
      res.setHeader(
        "Content-Disposition",
        `attachment; filename=${filename}${dateStr}.xlsx`
      );
      res.send(excelBuffer);
    } catch (error) {
      console.error('Error exporting orders:', error);
      res.status(500).json({ message: "Failed to export orders" });
    }
  });

  // Management Report Excel Export
  app.get("/api/reports/management-export", requireAuth, async (req, res) => {
    const { startDate, endDate, broker, product, businessType } = req.query;
    console.log('Management Report export request with params:', { startDate, endDate, broker, product, businessType });

    try {
      // Determine department
      const userDepartment = req.user!.department;
      const isPropertyEngineering = userDepartment === "Property & Engineering";
      const isLiabilityFinancial = userDepartment === "Liability & Financial";

      // Parse dates
      let parsedStartDate: Date | undefined;
      let parsedEndDate: Date | undefined;

      if (startDate && typeof startDate === 'string') {
        parsedStartDate = new Date(startDate);
        if (isNaN(parsedStartDate.getTime())) {
          return res.status(400).json({ message: "Invalid start date format" });
        }
      }

      if (endDate && typeof endDate === 'string') {
        parsedEndDate = new Date(endDate);
        if (isNaN(parsedEndDate.getTime())) {
          return res.status(400).json({ message: "Invalid end date format" });
        }
      }

      // Fetch quotations based on department
      let quotations: any[];
      let orders: any[];

      if (isPropertyEngineering) {
        quotations = await storage.listPropertyEngineeringQuotationsInDateRange(
          req.user!.id,
          parsedStartDate,
          parsedEndDate,
          undefined
        );
        orders = await storage.listPropertyEngineeringOrdersInDateRange(
          req.user!.id,
          parsedStartDate,
          parsedEndDate,
          undefined,
          true // Include all orders
        );
      } else if (isLiabilityFinancial) {
        quotations = await storage.listLiabilityQuotationsInDateRange(
          req.user!.id,
          parsedStartDate,
          parsedEndDate,
          undefined
        );
        orders = await storage.listLiabilityOrdersInDateRange(
          req.user!.id,
          parsedStartDate,
          parsedEndDate,
          undefined,
          true // Include all orders
        );
      } else {
        // Marine (default)
        quotations = await storage.listQuotationsInDateRange(
          req.user!.id,
          parsedStartDate,
          parsedEndDate,
          undefined
        );
        orders = await storage.listOrdersInDateRange(
          req.user!.id,
          parsedStartDate,
          parsedEndDate,
          undefined,
          true // Include all orders
        );
      }

      // Apply additional filters
      const filteredQuotations = quotations.filter((q: any) => {
        const matchesBroker = !broker || broker === 'all' || q.brokerName === broker;
        const productType = isPropertyEngineering || isLiabilityFinancial ? q.productType : q.marineProductType;
        const matchesProduct = !product || product === 'all' || productType === product;
        return matchesBroker && matchesProduct;
      });

      const filteredOrders = orders.filter((o: any) => {
        const matchesBroker = !broker || broker === 'all' || o.brokerName === broker;
        const productType = isPropertyEngineering || isLiabilityFinancial ? o.productType : o.marineProductType;
        const matchesProduct = !product || product === 'all' || productType === product;
        const matchesBusinessType = !businessType || businessType === 'all' || o.businessType === businessType;
        return matchesBroker && matchesProduct && matchesBusinessType;
      });

      // Create multiple worksheets for the Excel report
      const workbook = XLSX.utils.book_new();

      // Overview sheet
      const overviewData = [
        ["Management Report Overview"],
        ["Date Range", startDate && endDate 
          ? `${new Date(startDate as string).toLocaleDateString()} to ${new Date(endDate as string).toLocaleDateString()}`
          : "All Time"],
        ["Filters Applied"],
        ["Broker", broker ? broker : "All Brokers"],
        ["Product Type", product ? product : "All Products"],
        ["Business Type", businessType ? businessType : "All Types"],
        [""],
        ["QUOTATION METRICS"],
        ["Total Quotations", filteredQuotations.length],
        ["Open Quotations", filteredQuotations.filter(q => q.status === "Open").length],
        ["Confirmed Quotations", filteredQuotations.filter(q => q.status === "Confirmed").length],
        ["Declined Quotations", filteredQuotations.filter(q => q.status === "Decline").length],
        ["Conversion Rate (%)", filteredQuotations.length > 0 
          ? ((filteredQuotations.filter(q => q.status === "Confirmed").length / filteredQuotations.length) * 100).toFixed(2)
          : "0.00"],
        [""],
        ["ORDER METRICS"],
        ["Total Orders", filteredOrders.length],
        ["New Business Orders", filteredOrders.filter(o => o.businessType === "New Business").length],
        ["Renewal Orders", filteredOrders.filter(o => o.businessType === "Renewal").length],
        ["Total Premium", filteredOrders.reduce((sum, o) => sum + parseFloat(o.premium.toString()), 0).toFixed(2)],
        ["New Business Premium", filteredOrders
          .filter(o => o.businessType === "New Business")
          .reduce((sum, o) => sum + parseFloat(o.premium.toString()), 0).toFixed(2)],
        ["Renewal Premium", filteredOrders
          .filter(o => o.businessType === "Renewal")
          .reduce((sum, o) => sum + parseFloat(o.premium.toString()), 0).toFixed(2)]
      ];
      const overviewWs = XLSX.utils.aoa_to_sheet(overviewData);
      XLSX.utils.book_append_sheet(workbook, overviewWs, "Overview");

      // Quotations detail sheet
      const quotationsWs = XLSX.utils.json_to_sheet(
        filteredQuotations.map(q => ({
          "Broker Name": q.brokerName,
          "Insured Name": q.insuredName,
          "Product Type": q.marineProductType,
          "Estimated Premium": `${parseFloat(q.estimatedPremium.toString()).toFixed(2)} ${q.currency}`,
          "Quotation Date": new Date(q.quotationDate).toLocaleDateString('en-GB'),
          "Status": q.status,
          "Decline Reason": q.status === "Decline" ? q.declineReason : "-",
          "Notes": q.notes || "",
          "Last Updated": new Date(q.lastUpdated).toLocaleDateString('en-GB')
        }))
      );
      XLSX.utils.book_append_sheet(workbook, quotationsWs, "Quotations");

      // Orders detail sheet
      const ordersWs = XLSX.utils.json_to_sheet(
        filteredOrders.map(o => ({
          "Broker Name": o.brokerName,
          "Insured Name": o.insuredName,
          "Product Type": o.marineProductType,
          "Business Type": o.businessType,
          "Premium": `${parseFloat(o.premium.toString()).toFixed(2)} ${o.currency}`,
          "Order Date": new Date(o.orderDate).toLocaleDateString('en-GB'),
          "Statuses": o.statuses.join(", "),
          "Notes": o.notes || "",
          "Last Updated": new Date(o.lastUpdated).toLocaleDateString('en-GB')
        }))
      );
      XLSX.utils.book_append_sheet(workbook, ordersWs, "Orders");

      // Broker Analysis sheet
      const brokers = Array.from(new Set(filteredQuotations.map(q => q.brokerName)));
      const brokerAnalytics = brokers.map(broker => {
        const brokerQuotations = filteredQuotations.filter(q => q.brokerName === broker);
        const brokerOrders = filteredOrders.filter(o => o.brokerName === broker);
        
        const confirmed = brokerQuotations.filter(q => q.status === "Confirmed").length;
        const total = brokerQuotations.length;
        
        return {
          "Broker": broker,
          "Total Quotations": total,
          "Confirmed Quotations": confirmed,
          "Declined Quotations": brokerQuotations.filter(q => q.status === "Decline").length,
          "Open Quotations": brokerQuotations.filter(q => q.status === "Open").length,
          "Hit Ratio (%)": total > 0 ? (confirmed / total * 100).toFixed(2) : "0.00",
          "Orders Count": brokerOrders.length,
          "Total Premium": brokerOrders.reduce((sum, o) => sum + parseFloat(o.premium.toString()), 0).toFixed(2),
        };
      });
      
      const brokerWs = XLSX.utils.json_to_sheet(brokerAnalytics);
      XLSX.utils.book_append_sheet(workbook, brokerWs, "Broker Analysis");

      // Product Analysis sheet
      const productTypes = Array.from(new Set(filteredQuotations.map(q => q.marineProductType)));
      const productAnalytics = productTypes.map(product => {
        const productQuotations = filteredQuotations.filter(q => q.marineProductType === product);
        const productOrders = filteredOrders.filter(o => o.marineProductType === product);
        
        return {
          "Product Type": product,
          "Total Quotations": productQuotations.length,
          "Confirmed Quotations": productQuotations.filter(q => q.status === "Confirmed").length,
          "Confirmation Rate (%)": productQuotations.length > 0 
            ? (productQuotations.filter(q => q.status === "Confirmed").length / productQuotations.length * 100).toFixed(2)
            : "0.00",
          "Total Premium": productOrders.reduce((sum, o) => sum + parseFloat(o.premium.toString()), 0).toFixed(2),
          "Average Premium": productOrders.length > 0 
            ? (productOrders.reduce((sum, o) => sum + parseFloat(o.premium.toString()), 0) / productOrders.length).toFixed(2)
            : "0.00",
        };
      });
      
      const productWs = XLSX.utils.json_to_sheet(productAnalytics);
      XLSX.utils.book_append_sheet(workbook, productWs, "Product Analysis");

      // Insured Analysis sheet - Cross-department analysis
      try {
        // Fetch Property & Engineering data for cross-department analysis
        const peQuotations = await storage.listPropertyEngineeringQuotationsInDateRange(
          req.user!.id,
          parsedStartDate,
          parsedEndDate,
          undefined
        );
        const peOrders = await storage.listPropertyEngineeringOrdersInDateRange(
          req.user!.id,
          parsedStartDate,
          parsedEndDate,
          undefined,
          true
        );

        // Apply broker filter to P&E data if specified
        const filteredPEQuotations = peQuotations.filter(q => {
          const matchesBroker = !broker || broker === 'all' || q.brokerName === broker;
          return matchesBroker;
        });

        const filteredPEOrders = peOrders.filter(o => {
          const matchesBroker = !broker || broker === 'all' || o.brokerName === broker;
          const matchesBusinessType = !businessType || businessType === 'all' || o.businessType === businessType;
          return matchesBroker && matchesBusinessType;
        });

        // Get unique insured names from all departments
        const allInsuredNames = new Set<string>();
        filteredQuotations.forEach(q => allInsuredNames.add(q.insuredName));
        filteredOrders.forEach(o => allInsuredNames.add(o.insuredName));
        filteredPEQuotations.forEach(q => allInsuredNames.add(q.insuredName));
        filteredPEOrders.forEach(o => allInsuredNames.add(o.insuredName));

        const insuredAnalytics = Array.from(allInsuredNames).map(insuredName => {
          // Marine data for this insured
          const marineQuotations = filteredQuotations.filter(q => q.insuredName === insuredName);
          const marineOrders = filteredOrders.filter(o => o.insuredName === insuredName);
          
          // P&E data for this insured
          const peQuotationsForInsured = filteredPEQuotations.filter(q => q.insuredName === insuredName);
          const peOrdersForInsured = filteredPEOrders.filter(o => o.insuredName === insuredName);

          // Calculate totals across all departments
          const totalQuotations = marineQuotations.length + peQuotationsForInsured.length;
          const totalOrders = marineOrders.length + peOrdersForInsured.length;
          const totalPremium = 
            marineOrders.reduce((sum, o) => sum + parseFloat(o.premium.toString()), 0) +
            peOrdersForInsured.reduce((sum, o) => sum + parseFloat(o.premium.toString()), 0);

          // Get unique products across all departments
          const marineProducts = marineQuotations.map(q => q.marineProductType).filter(Boolean);
          const peProducts = peQuotationsForInsured.map(q => q.productType).filter(Boolean);
          const allProductsSet = new Set([...marineProducts, ...peProducts]);
          const allProducts = Array.from(allProductsSet);

          return {
            "Insured Name": insuredName,
            "Total Quotations": totalQuotations,
            "Marine Quotations": marineQuotations.length,
            "P&E Quotations": peQuotationsForInsured.length,
            "Total Orders": totalOrders,
            "Marine Orders": marineOrders.length,
            "P&E Orders": peOrdersForInsured.length,
            "Total Premium": totalPremium.toFixed(2),
            "Marine Premium": marineOrders.reduce((sum, o) => sum + parseFloat(o.premium.toString()), 0).toFixed(2),
            "P&E Premium": peOrdersForInsured.reduce((sum, o) => sum + parseFloat(o.premium.toString()), 0).toFixed(2),
            "Products": allProducts.join(", "),
            "Average Premium per Order": totalOrders > 0 ? (totalPremium / totalOrders).toFixed(2) : "0.00",
          };
        }).sort((a, b) => parseFloat(b["Total Premium"]) - parseFloat(a["Total Premium"])); // Sort by total premium descending

        const insuredWs = XLSX.utils.json_to_sheet(insuredAnalytics);
        XLSX.utils.book_append_sheet(workbook, insuredWs, "Insured Analysis");
      } catch (error) {
        console.error('Error generating insured analysis:', error);
        // Continue without the insured analysis sheet if there's an error
      }

      // Generate the Excel file
      const excelBuffer = XLSX.write(workbook, { type: "buffer", bookType: "xlsx" });

      // Set response headers and send the file
      res.setHeader(
        "Content-Type",
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
      );
      res.setHeader(
        "Content-Disposition",
        `attachment; filename=management_report_${new Date().toISOString().split('T')[0]}.xlsx`
      );
      res.send(excelBuffer);
    } catch (error) {
      console.error('Error generating management report:', error);
      res.status(500).json({ message: "Failed to generate report" });
    }
  });

  // Cross-department analytics routes for insured analysis
  app.get("/api/analytics/insured-names", requireAuth, async (req, res) => {
    try {
      // Get unique insured names from all departments: Marine, Property & Engineering, and Liability & Financial
      const marineQuotations = await storage.listQuotations(req.user!.id);
      const marineOrders = await storage.listOrdersInDateRange(req.user!.id, undefined, undefined, undefined, true);
      
      const peQuotations = await storage.listPropertyEngineeringQuotations(req.user!.id);
      const peOrders = await storage.listPropertyEngineeringOrdersInDateRange(req.user!.id, undefined, undefined, undefined, true);
      
      const liabilityQuotations = await storage.listLiabilityQuotations(req.user!.id);
      const liabilityOrders = await storage.listLiabilityOrdersInDateRange(req.user!.id, undefined, undefined, undefined, true);
      
      // Combine all insured names from all departments
      const allInsuredNames = new Set<string>();
      
      marineQuotations.forEach(q => allInsuredNames.add(q.insuredName));
      marineOrders.forEach(o => allInsuredNames.add(o.insuredName));
      peQuotations.forEach(q => allInsuredNames.add(q.insuredName));
      peOrders.forEach(o => allInsuredNames.add(o.insuredName));
      liabilityQuotations.forEach(q => allInsuredNames.add(q.insuredName));
      liabilityOrders.forEach(o => allInsuredNames.add(o.insuredName));
      
      const insuredNames = Array.from(allInsuredNames).sort();
      res.json(insuredNames);
    } catch (error) {
      console.error('Error fetching insured names:', error);
      res.status(500).json({ message: "Failed to fetch insured names" });
    }
  });

  app.get("/api/analytics/insured/:insuredName", requireAuth, async (req, res) => {
    const { insuredName } = req.params;
    const { startDate, endDate } = req.query;
    
    try {
      const parsedStartDate = startDate ? new Date(startDate as string) : undefined;
      const parsedEndDate = endDate ? new Date(endDate as string) : undefined;
      
      // Fetch data from all departments for the specific insured
      const marineQuotations = await storage.listQuotationsInDateRange(
        req.user!.id, parsedStartDate, parsedEndDate, undefined
      );
      const marineOrders = await storage.listOrdersInDateRange(
        req.user!.id, parsedStartDate, parsedEndDate, undefined, true
      );
      
      const peQuotations = await storage.listPropertyEngineeringQuotationsInDateRange(
        req.user!.id, parsedStartDate, parsedEndDate, undefined
      );
      const peOrders = await storage.listPropertyEngineeringOrdersInDateRange(
        req.user!.id, parsedStartDate, parsedEndDate, undefined, true
      );
      
      const liabilityQuotations = await storage.listLiabilityQuotationsInDateRange(
        req.user!.id, parsedStartDate, parsedEndDate, undefined
      );
      const liabilityOrders = await storage.listLiabilityOrdersInDateRange(
        req.user!.id, parsedStartDate, parsedEndDate, undefined, true
      );
      
      // Filter by insured name
      const filteredMarineQuotations = marineQuotations.filter(q => q.insuredName === insuredName);
      const filteredMarineOrders = marineOrders.filter(o => o.insuredName === insuredName);
      const filteredPEQuotations = peQuotations.filter(q => q.insuredName === insuredName);
      const filteredPEOrders = peOrders.filter(o => o.insuredName === insuredName);
      const filteredLiabilityQuotations = liabilityQuotations.filter(q => q.insuredName === insuredName);
      const filteredLiabilityOrders = liabilityOrders.filter(o => o.insuredName === insuredName);
      
      // Calculate metrics per department
      const marineMetrics = {
        department: "Marine",
        quotations: {
          total: filteredMarineQuotations.length,
          open: filteredMarineQuotations.filter(q => q.status === "Open").length,
          confirmed: filteredMarineQuotations.filter(q => q.status === "Confirmed").length,
          declined: filteredMarineQuotations.filter(q => q.status === "Decline").length,
          estimatedPremium: filteredMarineQuotations.reduce((sum, q) => sum + parseFloat(q.estimatedPremium.toString()), 0)
        },
        orders: {
          total: filteredMarineOrders.length,
          newBusiness: filteredMarineOrders.filter(o => o.businessType === "New Business").length,
          renewal: filteredMarineOrders.filter(o => o.businessType === "Renewal").length,
          totalPremium: filteredMarineOrders.reduce((sum, o) => sum + parseFloat(o.premium.toString()), 0),
          newBusinessPremium: filteredMarineOrders.filter(o => o.businessType === "New Business").reduce((sum, o) => sum + parseFloat(o.premium.toString()), 0),
          renewalPremium: filteredMarineOrders.filter(o => o.businessType === "Renewal").reduce((sum, o) => sum + parseFloat(o.premium.toString()), 0)
        }
      };
      
      const peMetrics = {
        department: "Property & Engineering",
        quotations: {
          total: filteredPEQuotations.length,
          open: filteredPEQuotations.filter(q => q.status === "Open").length,
          confirmed: filteredPEQuotations.filter(q => q.status === "Confirmed").length,
          declined: filteredPEQuotations.filter(q => q.status === "Decline").length,
          estimatedPremium: filteredPEQuotations.reduce((sum, q) => sum + parseFloat(q.estimatedPremium.toString()), 0)
        },
        orders: {
          total: filteredPEOrders.length,
          newBusiness: filteredPEOrders.filter(o => o.businessType === "New Business").length,
          renewal: filteredPEOrders.filter(o => o.businessType === "Renewal").length,
          totalPremium: filteredPEOrders.reduce((sum, o) => sum + parseFloat(o.premium.toString()), 0),
          newBusinessPremium: filteredPEOrders.filter(o => o.businessType === "New Business").reduce((sum, o) => sum + parseFloat(o.premium.toString()), 0),
          renewalPremium: filteredPEOrders.filter(o => o.businessType === "Renewal").reduce((sum, o) => sum + parseFloat(o.premium.toString()), 0)
        }
      };
      
      const liabilityMetrics = {
        department: "Liability & Financial",
        quotations: {
          total: filteredLiabilityQuotations.length,
          open: filteredLiabilityQuotations.filter(q => q.status === "Open").length,
          confirmed: filteredLiabilityQuotations.filter(q => q.status === "Confirmed").length,
          declined: filteredLiabilityQuotations.filter(q => q.status === "Decline").length,
          estimatedPremium: filteredLiabilityQuotations.reduce((sum, q) => sum + parseFloat(q.estimatedPremium.toString()), 0)
        },
        orders: {
          total: filteredLiabilityOrders.length,
          newBusiness: filteredLiabilityOrders.filter(o => o.businessType === "New Business").length,
          renewal: filteredLiabilityOrders.filter(o => o.businessType === "Renewal").length,
          totalPremium: filteredLiabilityOrders.reduce((sum, o) => sum + parseFloat(o.premium.toString()), 0),
          newBusinessPremium: filteredLiabilityOrders.filter(o => o.businessType === "New Business").reduce((sum, o) => sum + parseFloat(o.premium.toString()), 0),
          renewalPremium: filteredLiabilityOrders.filter(o => o.businessType === "Renewal").reduce((sum, o) => sum + parseFloat(o.premium.toString()), 0)
        }
      };
      
      // Calculate totals across all departments
      const totalMetrics = {
        quotations: {
          total: marineMetrics.quotations.total + peMetrics.quotations.total + liabilityMetrics.quotations.total,
          open: marineMetrics.quotations.open + peMetrics.quotations.open + liabilityMetrics.quotations.open,
          confirmed: marineMetrics.quotations.confirmed + peMetrics.quotations.confirmed + liabilityMetrics.quotations.confirmed,
          declined: marineMetrics.quotations.declined + peMetrics.quotations.declined + liabilityMetrics.quotations.declined,
          estimatedPremium: marineMetrics.quotations.estimatedPremium + peMetrics.quotations.estimatedPremium + liabilityMetrics.quotations.estimatedPremium
        },
        orders: {
          total: marineMetrics.orders.total + peMetrics.orders.total + liabilityMetrics.orders.total,
          newBusiness: marineMetrics.orders.newBusiness + peMetrics.orders.newBusiness + liabilityMetrics.orders.newBusiness,
          renewal: marineMetrics.orders.renewal + peMetrics.orders.renewal + liabilityMetrics.orders.renewal,
          totalPremium: marineMetrics.orders.totalPremium + peMetrics.orders.totalPremium + liabilityMetrics.orders.totalPremium,
          newBusinessPremium: marineMetrics.orders.newBusinessPremium + peMetrics.orders.newBusinessPremium + liabilityMetrics.orders.newBusinessPremium,
          renewalPremium: marineMetrics.orders.renewalPremium + peMetrics.orders.renewalPremium + liabilityMetrics.orders.renewalPremium
        }
      };
      
      res.json({
        insuredName,
        departments: [marineMetrics, peMetrics, liabilityMetrics],
        totals: totalMetrics
      });
    } catch (error) {
      console.error('Error fetching insured analytics:', error);
      res.status(500).json({ message: "Failed to fetch insured analytics" });
    }
  });

  // Liability & Financial Order management routes (Liability & Financial department only)
  app.post("/api/liability/orders", requireDepartment("Liability & Financial"), async (req, res) => {
    console.log('Received Liability & Financial order data:', req.body);
    const parseResult = insertLiabilityOrderSchema.safeParse(req.body);
    if (!parseResult.success) {
      console.error('Liability & Financial order validation failed:', parseResult.error);
      res.status(400).json(parseResult.error);
      return;
    }

    const order = await storage.createLiabilityOrder(parseResult.data, req.user!.id);
    res.status(201).json(order);
  });

  app.get("/api/liability/orders", requireDepartment("Liability & Financial"), async (req, res) => {
    try {
      const { startDate, endDate, status, includeAll } = req.query;
      
      if (status || startDate || endDate || includeAll) {
        const parsedStartDate = startDate ? new Date(startDate as string) : undefined;
        const parsedEndDate = endDate ? new Date(endDate as string) : undefined;
        
        const orders = await storage.listLiabilityOrdersInDateRange(
          req.user!.id,
          parsedStartDate,
          parsedEndDate,
          status as string | undefined,
          includeAll === 'true'
        );
        res.json(orders);
      } else {
        const orders = await storage.listLiabilityOrders(req.user!.id);
        res.json(orders);
      }
    } catch (error) {
      console.error('Error fetching Liability & Financial orders:', error);
      res.status(500).json({ message: "Failed to fetch Liability & Financial orders" });
    }
  });

  app.get("/api/liability/orders/:id", requireDepartment("Liability & Financial"), async (req, res) => {
    const order = await storage.getLiabilityOrder(parseInt(req.params.id));
    if (!order) {
      res.status(404).json({ message: "Liability & Financial order not found" });
      return;
    }
    res.json(order);
  });

  app.put("/api/liability/orders/:id", requireDepartment("Liability & Financial"), async (req, res) => {
    console.log('Updating Liability & Financial order:', req.params.id, req.body);
    const parseResult = insertLiabilityOrderSchema.safeParse(req.body);
    if (!parseResult.success) {
      console.error('Liability & Financial order update validation failed:', parseResult.error);
      res.status(400).json(parseResult.error);
      return;
    }

    try {
      // Get the current order to check for status change
      const currentOrder = await storage.getLiabilityOrder(parseInt(req.params.id));
      if (!currentOrder) {
        res.status(404).json({ message: "Order not found" });
        return;
      }

      const updatedOrder = await storage.updateLiabilityOrder(
        parseInt(req.params.id),
        parseResult.data,
      );

      // Check if the order was moved to "Policy Issued" status
      const hasMovedToClosed = !currentOrder.statuses.includes("Policy Issued") &&
        parseResult.data.statuses?.includes("Policy Issued");

      res.json({
        order: updatedOrder,
        hasMovedToClosed,
      });
    } catch (error) {
      console.error('Error updating Liability & Financial order:', error);
      res.status(500).json({ message: "Failed to update Liability & Financial order" });
    }
  });

  app.delete("/api/liability/orders/:id", requireDepartment("Liability & Financial"), async (req, res) => {
    const order = await storage.getLiabilityOrder(parseInt(req.params.id));
    if (!order) {
      res.status(404).json({ message: "Liability & Financial order not found" });
      return;
    }

    await storage.deleteLiabilityOrder(parseInt(req.params.id));
    res.sendStatus(200);
  });

  // Liability & Financial Quotation management routes (Liability & Financial department only)
  app.post("/api/liability/quotations", requireDepartment("Liability & Financial"), async (req, res) => {
    console.log('Received Liability & Financial quotation data:', req.body);
    const parseResult = insertLiabilityQuotationSchema.safeParse(req.body);
    if (!parseResult.success) {
      console.error('Liability & Financial quotation validation failed:', parseResult.error);
      res.status(400).json(parseResult.error);
      return;
    }

    const quotation = await storage.createLiabilityQuotation(parseResult.data, req.user!.id);
    res.status(201).json(quotation);
  });

  app.get("/api/liability/quotations", requireDepartment("Liability & Financial"), async (req, res) => {
    try {
      const quotations = await storage.listLiabilityQuotations(req.user!.id);
      res.json(quotations);
    } catch (error) {
      console.error('Error fetching Liability & Financial quotations:', error);
      res.status(500).json({ message: "Failed to fetch Liability & Financial quotations" });
    }
  });

  app.get("/api/liability/quotations/:id", requireDepartment("Liability & Financial"), async (req, res) => {
    const quotation = await storage.getLiabilityQuotation(parseInt(req.params.id));
    if (!quotation) {
      res.status(404).json({ message: "Liability & Financial quotation not found" });
      return;
    }
    res.json(quotation);
  });

  app.put("/api/liability/quotations/:id", requireDepartment("Liability & Financial"), async (req, res) => {
    console.log('Updating Liability & Financial quotation:', req.params.id, req.body);
    const parseResult = insertLiabilityQuotationSchema.safeParse(req.body);
    if (!parseResult.success) {
      console.error('Liability & Financial quotation update validation failed:', parseResult.error);
      res.status(400).json(parseResult.error);
      return;
    }

    try {
      const updatedQuotation = await storage.updateLiabilityQuotation(
        parseInt(req.params.id),
        parseResult.data,
      );
      res.json(updatedQuotation);
    } catch (error) {
      console.error('Error updating Liability & Financial quotation:', error);
      res.status(500).json({ message: "Failed to update Liability & Financial quotation" });
    }
  });

  app.delete("/api/liability/quotations/:id", requireDepartment("Liability & Financial"), async (req, res) => {
    const quotation = await storage.getLiabilityQuotation(parseInt(req.params.id));
    if (!quotation) {
      res.status(404).json({ message: "Liability & Financial quotation not found" });
      return;
    }

    await storage.deleteLiabilityQuotation(parseInt(req.params.id));
    res.sendStatus(200);
  });

  // Liability & Financial Export routes
  app.get("/api/liability/orders/export/:status", requireDepartment("Liability & Financial"), async (req, res) => {
    const { startDate, endDate, businessType, ids } = req.query;
    const { status } = req.params;
    console.log('Liability Export request:', { startDate, endDate, businessType, ids, status });

    try {
      const parsedStartDate = startDate ? new Date(startDate as string) : undefined;
      const parsedEndDate = endDate ? new Date(endDate as string) : undefined;

      const orders = await storage.listLiabilityOrders(req.user!.id);

      // Apply filters
      let filteredOrders = orders;
      
      // Status filter (unless exporting "all" or "selected")
      if (status !== 'all' && status !== 'selected') {
        filteredOrders = filteredOrders.filter(order => order.statuses.includes(status));
      }
      
      // Date filter
      if (parsedStartDate || parsedEndDate) {
        filteredOrders = filteredOrders.filter(order => {
          const orderDate = new Date(order.orderDate);
          const matchesStart = !parsedStartDate || orderDate >= parsedStartDate;
          const matchesEnd = !parsedEndDate || orderDate <= parsedEndDate;
          return matchesStart && matchesEnd;
        });
      }

      // Business type filter
      if (businessType && businessType !== 'all') {
        filteredOrders = filteredOrders.filter(order => order.businessType === businessType);
      }

      // IDs filter (for selected items export)
      if (status === 'selected' && ids && Array.isArray(ids)) {
        const selectedIds = (ids as string[]).map(id => parseInt(id));
        filteredOrders = filteredOrders.filter(order => selectedIds.includes(order.id));
      }

      console.log(`Exporting ${filteredOrders.length} Liability orders`);

      const workbook = XLSX.utils.book_new();
      const worksheet = XLSX.utils.json_to_sheet(
        filteredOrders.map(order => ({
          "Broker Name": order.brokerName,
          "Insured Name": order.insuredName,
          "Product Type": order.productType,
          "Business Type": order.businessType,
          "Premium": `${parseFloat(order.premium.toString()).toFixed(2)} ${order.currency}`,
          "Order Date": new Date(order.orderDate).toLocaleDateString('en-GB'),
          "Statuses": order.statuses.join(", "),
          "Notes": order.notes || "",
          "Last Updated": new Date(order.lastUpdated).toLocaleDateString('en-GB')
        }))
      );

      XLSX.utils.book_append_sheet(workbook, worksheet, "Liability Orders");
      const excelBuffer = XLSX.write(workbook, { type: "buffer", bookType: "xlsx" });

      res.setHeader(
        "Content-Type",
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
      );
      res.setHeader(
        "Content-Disposition",
        `attachment; filename=liability_orders_${status}_${new Date().toISOString().split('T')[0]}.xlsx`
      );
      res.send(excelBuffer);
    } catch (error) {
      console.error('Error exporting Liability orders:', error);
      res.status(500).json({ message: "Failed to export orders" });
    }
  });

  app.get("/api/liability/quotations/export/:status", requireDepartment("Liability & Financial"), async (req, res) => {
    const { startDate, endDate, ids } = req.query;
    const { status } = req.params;
    console.log('Liability Quotations Export request:', { startDate, endDate, ids, status });

    try {
      const parsedStartDate = startDate ? new Date(startDate as string) : undefined;
      const parsedEndDate = endDate ? new Date(endDate as string) : undefined;

      const quotations = await storage.listLiabilityQuotations(req.user!.id);

      // Apply filters
      let filteredQuotations = quotations;
      
      // Status filter (unless exporting "all" or "selected")
      if (status !== 'all' && status !== 'selected') {
        filteredQuotations = filteredQuotations.filter(quotation => quotation.status === status);
      }
      
      // Date filter
      if (parsedStartDate || parsedEndDate) {
        filteredQuotations = filteredQuotations.filter(quotation => {
          const quotationDate = new Date(quotation.quotationDate);
          const matchesStart = !parsedStartDate || quotationDate >= parsedStartDate;
          const matchesEnd = !parsedEndDate || quotationDate <= parsedEndDate;
          return matchesStart && matchesEnd;
        });
      }

      // IDs filter (for selected items export)
      if (status === 'selected' && ids && Array.isArray(ids)) {
        const selectedIds = (ids as string[]).map(id => parseInt(id));
        filteredQuotations = filteredQuotations.filter(quotation => selectedIds.includes(quotation.id));
      }

      console.log(`Exporting ${filteredQuotations.length} Liability quotations`);

      // Create CSV data
      const csvData = [
        ["Broker Name", "Insured Name", "Product Type", "Estimated Premium", "Currency", "Quotation Date", "Status", "Decline Reason", "Notes", "Last Updated"],
        ...filteredQuotations.map(quotation => [
          quotation.brokerName,
          quotation.insuredName,
          quotation.productType,
          parseFloat(quotation.estimatedPremium.toString()).toFixed(2),
          quotation.currency,
          new Date(quotation.quotationDate).toLocaleDateString('en-GB'),
          quotation.status,
          quotation.declineReason || "",
          quotation.notes || "",
          new Date(quotation.lastUpdated).toLocaleDateString('en-GB')
        ])
      ];

      // Convert to CSV string
      const csvContent = csvData.map(row => 
        row.map(cell => `"${String(cell).replace(/"/g, '""')}"`).join(',')
      ).join('\n');

      res.setHeader("Content-Type", "text/csv");
      res.setHeader(
        "Content-Disposition",
        `attachment; filename=liability_quotations_${status}_${new Date().toISOString().split('T')[0]}.csv`
      );
      res.send(csvContent);
    } catch (error) {
      console.error('Error exporting Liability quotations:', error);
      res.status(500).json({ message: "Failed to export quotations" });
    }
  });

  const httpServer = createServer(app);
  return httpServer;
}