import { useState, useMemo, useRef } from "react";
import { useQuery } from "@tanstack/react-query";
import { Calendar } from "@/components/ui/calendar";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { format } from "date-fns";
import {
  FileDown,
  ArrowLeft,
  Ship,
  Building,
  BarChart4,
  LineChart,
  PieChart,
  TrendingUp,
  Users,
  Package,
  RefreshCw,
  ChevronDown,
  Check,
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { Link } from "wouter";
import { ScrollToTop } from "@/components/ui/scroll-to-top";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  PieChart as RePieChart,
  Pie,
  Cell,
  LineChart as ReLineChart,
  Line,
  AreaChart,
  Area,
} from "recharts";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
} from "@/components/ui/command";
import { toPng } from "html-to-image";
import jsPDF from "jspdf";
import { useAuth } from "@/hooks/use-auth";

// Define interfaces for our data structures
interface Quotation {
  id: number;
  brokerName: string;
  insuredName: string;
  marineProductType?: string; // Marine only
  productType?: string; // P&E only
  estimatedPremium: number | string;
  currency: string;
  quotationDate: string;
  status: string;
  declineReason?: string;
  notes?: string;
  lastUpdated: string;
}

interface Order {
  id: number;
  brokerName: string;
  insuredName: string;
  marineProductType?: string; // Marine only
  productType?: string; // P&E only
  businessType: string;
  premium: number | string;
  currency: string;
  orderDate: string;
  statuses: string[];
  notes?: string;
  lastUpdated: string;
}

interface OverviewData {
  totalQuotations: number;
  openQuotations: number;
  confirmedQuotations: number;
  declinedQuotations: number;
  conversionRate: string | number;
  avgEstimatedPremium: string | number;
  totalOrdersCount: number;
  totalPremium: string | number;
  newBusinessCount: number;
  renewalCount: number;
  newBusinessPremium: string | number;
  renewalPremium: string | number;
}

interface BrokerAnalytics {
  name: string;
  quotationsCount: number;
  confirmedCount: number;
  declinedCount: number;
  openCount: number;
  hitRatio: string | number;
  ordersCount: number;
  premium: string | number;
}

interface ProductAnalytics {
  name: string;
  quotationsCount: number;
  confirmedCount: number;
  premium: string | number;
  avgPremium: string | number;
}

interface BusinessTypeAnalytics {
  name: string;
  count: number;
  premium: string | number;
  avgPremium: string | number;
}

interface TimeSeriesData {
  date: string;
  newQuotations: number;
  confirmedQuotations: number;
  premium: number;
}

interface InsuredAnalytics {
  insuredName: string;
  departments: DepartmentMetrics[];
  totals: TotalMetrics;
}

interface DepartmentMetrics {
  department: string;
  quotations: {
    total: number;
    open: number;
    confirmed: number;
    declined: number;
    estimatedPremium: number;
  };
  orders: {
    total: number;
    newBusiness: number;
    renewal: number;
    totalPremium: number;
    newBusinessPremium: number;
    renewalPremium: number;
  };
}

interface TotalMetrics {
  quotations: {
    total: number;
    open: number;
    confirmed: number;
    declined: number;
    estimatedPremium: number;
  };
  orders: {
    total: number;
    newBusiness: number;
    renewal: number;
    totalPremium: number;
    newBusinessPremium: number;
    renewalPremium: number;
  };
}

// Define status colors for consistent usage
const STATUS_COLORS = {
  Open: "#0088FE",
  Confirmed: "#00C49F",
  Decline: "#FF8042",
  NewBusiness: "#8884d8",
  Renewal: "#82ca9d",
};

// Chart color schemes
const COLORS = [
  "#0088FE", // blue
  "#00C49F", // green
  "#FFBB28", // yellow
  "#FF8042", // orange
  "#8884d8", // purple
  "#82ca9d", // light green
  "#ffc658", // light orange
  "#8dd1e1", // light blue
  "#a4de6c", // lime
  "#d0ed57", // yellow-green
];

// Define a safe formatter function for tooltips
const safeNumberFormat = (
  value: any,
  withUnit: string = "",
  percentDisplay: boolean = false
): string => {
  try {
    // For percentage values that are already formatted
    if (percentDisplay && typeof value === "string" && value.includes("%")) {
      return value; // Already has % sign, return as is
    }

    // Convert to number safely
    const numValue =
      typeof value === "number"
        ? value
        : parseFloat(String(value || 0).replace("%", "")); // Remove any % signs before parsing

    // Format the number with commas
    const formatted = new Intl.NumberFormat("en-US").format(numValue);

    // Return with unit if provided
    return percentDisplay
      ? `${formatted}%`
      : withUnit
      ? `${formatted} ${withUnit}`
      : formatted;
  } catch (e) {
    // Return safe value in case of parsing errors
    return String(value || "0").replace("%%", "%"); // Fix double % if it exists
  }
};

export default function ManagementReport() {
  const { toast } = useToast();
  const { user } = useAuth();
  const [startDate, setStartDate] = useState<Date>();
  const [endDate, setEndDate] = useState<Date>();
  const [selectedTab, setSelectedTab] = useState("overview");
  const [selectedBrokers, setSelectedBrokers] = useState<string[]>(["all"]);
  const [selectedProduct, setSelectedProduct] = useState<string>("all");
  const [selectedBusinessType, setSelectedBusinessType] =
    useState<string>("all");
  const [selectedInsured, setSelectedInsured] = useState<string[]>(["all"]);
  const [showCrossDepartmentView, setShowCrossDepartmentView] =
    useState<boolean>(false);

  // Determine API endpoints based on user department
  const isPropertyEngineering = user?.department === "Property & Engineering";
  const isLiabilityFinancial = user?.department === "Liability & Financial";
  const quotationsEndpoint = isPropertyEngineering
    ? "/api/property-engineering/quotations"
    : isLiabilityFinancial
    ? "/api/liability/quotations"
    : "/api/quotations";
  const ordersEndpoint = isPropertyEngineering
    ? "/api/property-engineering/orders"
    : isLiabilityFinancial
    ? "/api/liability/orders"
    : "/api/orders";

  // Add refs for charts to capture them for PDF export
  const overviewChartRef = useRef<HTMLDivElement>(null);
  const premiumDistributionRef = useRef<HTMLDivElement>(null);
  const quotationStatusRef = useRef<HTMLDivElement>(null);
  const brokerPerformanceRef = useRef<HTMLDivElement>(null);
  const productPerformanceRef = useRef<HTMLDivElement>(null);

  // Fetch quotations data with filters
  const { data: quotations, isLoading: quotationsLoading } = useQuery<
    Quotation[]
  >({
    queryKey: [
      quotationsEndpoint,
      startDate?.toISOString(),
      endDate?.toISOString(),
    ],
    queryFn: async () => {
      const params = new URLSearchParams();

      if (startDate) {
        const start = new Date(startDate);
        start.setHours(0, 0, 0, 0);
        params.append("startDate", start.toISOString());
      }

      if (endDate) {
        const end = new Date(endDate);
        end.setHours(23, 59, 59, 999);
        params.append("endDate", end.toISOString());
      }

      console.log(`Fetching quotations with params: ${params.toString()}`);
      const response = await fetch(
        `${quotationsEndpoint}?${params.toString()}`,
        {
          credentials: "include",
        }
      );

      if (!response.ok) {
        throw new Error("Failed to fetch quotations");
      }

      return response.json();
    },
  });

  // Fetch orders data with filters
  const { data: orders, isLoading: ordersLoading } = useQuery<Order[]>({
    queryKey: [
      ordersEndpoint,
      startDate?.toISOString(),
      endDate?.toISOString(),
    ],
    queryFn: async () => {
      const params = new URLSearchParams();

      if (startDate) {
        const start = new Date(startDate);
        start.setHours(0, 0, 0, 0);
        params.append("startDate", start.toISOString());
      }

      if (endDate) {
        const end = new Date(endDate);
        end.setHours(23, 59, 59, 999);
        params.append("endDate", end.toISOString());
      }

      if (!isPropertyEngineering) {
        params.append("includeAll", "true");
      }

      console.log(`Fetching orders with params: ${params.toString()}`);
      const response = await fetch(`${ordersEndpoint}?${params.toString()}`, {
        credentials: "include",
      });

      if (!response.ok) {
        throw new Error("Failed to fetch orders");
      }

      return response.json();
    },
  });

  // Fetch insured names for cross-department analytics
  const { data: insuredNames, isLoading: insuredNamesLoading } = useQuery<
    string[]
  >({
    queryKey: ["insured-names"],
    queryFn: async () => {
      const response = await fetch("/api/analytics/insured-names", {
        credentials: "include",
      });

      if (!response.ok) {
        throw new Error("Failed to fetch insured names");
      }

      return response.json();
    },
  });

  // Fetch cross-department data for specific insured
  const { data: insuredAnalytics, isLoading: insuredAnalyticsLoading } =
    useQuery<InsuredAnalytics[]>({
      queryKey: [
        "insured-analytics",
        selectedInsured,
        startDate?.toISOString(),
        endDate?.toISOString(),
      ],
      queryFn: async () => {
        if (selectedInsured.includes("all") || selectedInsured.length === 0) {
          throw new Error("No specific insured selected");
        }

        const params = new URLSearchParams();

        if (startDate) {
          const start = new Date(startDate);
          start.setHours(0, 0, 0, 0);
          params.append("startDate", start.toISOString());
        }

        if (endDate) {
          const end = new Date(endDate);
          end.setHours(23, 59, 59, 999);
          params.append("endDate", end.toISOString());
        }

        // Fetch data for all selected insured companies
        const promises = selectedInsured.map(async (insured) => {
          const response = await fetch(
            `/api/analytics/insured/${encodeURIComponent(
              insured
            )}?${params.toString()}`,
            {
              credentials: "include",
            }
          );

          if (!response.ok) {
            throw new Error(`Failed to fetch analytics for ${insured}`);
          }

          return response.json();
        });

        return Promise.all(promises);
      },
      enabled:
        !selectedInsured.includes("all") &&
        selectedInsured.length > 0 &&
        showCrossDepartmentView,
    });

  // Process quotations and orders data
  const {
    filteredQuotations,
    filteredOrders,
    brokers,
    productTypes,
    businessTypes,
    currentInsuredNames,
    overviewData,
    brokerAnalytics,
    productAnalytics,
    businessTypeAnalytics,
    timeSeriesData,
  } = useMemo(() => {
    // Filter data based on user selections
    const filterQuotations = () => {
      if (!quotations) return [];

      return quotations.filter((q: Quotation) => {
        const matchesBroker =
          selectedBrokers.includes("all") ||
          selectedBrokers.includes(q.brokerName);
        const productType = isPropertyEngineering
          ? q.productType
          : isLiabilityFinancial
          ? q.productType
          : q.marineProductType;
        const matchesProduct =
          selectedProduct === "all" || productType === selectedProduct;
        const matchesInsured =
          selectedInsured.includes("all") ||
          selectedInsured.includes(q.insuredName);
        return matchesBroker && matchesProduct && matchesInsured;
      });
    };

    const filterOrders = () => {
      if (!orders) return [];

      return orders.filter((o: Order) => {
        const matchesBroker =
          selectedBrokers.includes("all") ||
          selectedBrokers.includes(o.brokerName);
        const productType = isPropertyEngineering
          ? o.productType
          : isLiabilityFinancial
          ? o.productType
          : o.marineProductType;
        const matchesProduct =
          selectedProduct === "all" || productType === selectedProduct;
        const matchesBusinessType =
          selectedBusinessType === "all" ||
          o.businessType === selectedBusinessType;
        const matchesInsured =
          selectedInsured.includes("all") ||
          selectedInsured.includes(o.insuredName);
        return (
          matchesBroker &&
          matchesProduct &&
          matchesBusinessType &&
          matchesInsured
        );
      });
    };

    const filteredQuotations = filterQuotations();
    const filteredOrders = filterOrders();

    // Extract unique values for filters
    const brokers = quotations
      ? Array.from(
          new Set<string>(quotations.map((q: Quotation) => q.brokerName))
        )
      : [];

    const productTypes = quotations
      ? Array.from(
          new Set<string>(
            quotations
              .map((q: Quotation) =>
                isPropertyEngineering
                  ? q.productType
                  : isLiabilityFinancial
                  ? q.productType
                  : q.marineProductType
              )
              .filter(Boolean) as string[]
          )
        )
      : [];

    const businessTypes = orders
      ? Array.from(new Set<string>(orders.map((o: Order) => o.businessType)))
      : [];

    // Extract insured names from current department data
    const currentInsuredNames =
      quotations && orders
        ? Array.from(
            new Set<string>([
              ...quotations.map((q: Quotation) => q.insuredName),
              ...orders.map((o: Order) => o.insuredName),
            ])
          ).sort()
        : [];

    // Calculate overview metrics
    const openQuotations = filteredQuotations.filter(
      (q: Quotation) => q.status === "Open"
    ).length;
    const confirmedQuotations = filteredQuotations.filter(
      (q: Quotation) => q.status === "Confirmed"
    ).length;
    const declinedQuotations = filteredQuotations.filter(
      (q: Quotation) => q.status === "Decline"
    ).length;

    const overviewData: OverviewData = {
      totalQuotations: filteredQuotations.length,
      openQuotations: openQuotations,
      confirmedQuotations: confirmedQuotations,
      declinedQuotations: declinedQuotations,
      conversionRate:
        openQuotations + confirmedQuotations > 0
          ? (
              (confirmedQuotations / (openQuotations + confirmedQuotations)) *
              100
            ).toFixed(2)
          : 0,
      avgEstimatedPremium:
        filteredQuotations.length > 0
          ? (
              filteredQuotations.reduce(
                (sum: number, q: Quotation) =>
                  sum + parseFloat(q.estimatedPremium.toString()),
                0
              ) / filteredQuotations.length
            ).toFixed(2)
          : 0,
      totalOrdersCount: filteredOrders.length,
      totalPremium: filteredOrders
        .reduce(
          (sum: number, o: Order) => sum + parseFloat(o.premium.toString()),
          0
        )
        .toFixed(2),
      newBusinessCount: filteredOrders.filter(
        (o: Order) => o.businessType === "New Business"
      ).length,
      renewalCount: filteredOrders.filter(
        (o: Order) => o.businessType === "Renewal"
      ).length,
      newBusinessPremium: filteredOrders
        .filter((o: Order) => o.businessType === "New Business")
        .reduce(
          (sum: number, o: Order) => sum + parseFloat(o.premium.toString()),
          0
        )
        .toFixed(2),
      renewalPremium: filteredOrders
        .filter((o: Order) => o.businessType === "Renewal")
        .reduce(
          (sum: number, o: Order) => sum + parseFloat(o.premium.toString()),
          0
        )
        .toFixed(2),
    };

    // Broker analytics
    const brokerAnalytics: BrokerAnalytics[] = brokers.map((broker) => {
      const brokerQuotations = filteredQuotations.filter(
        (q: Quotation) => q.brokerName === broker
      );
      const brokerOrders = filteredOrders.filter(
        (o: Order) => o.brokerName === broker
      );

      const confirmed = brokerQuotations.filter(
        (q: Quotation) => q.status === "Confirmed"
      ).length;
      const total = brokerQuotations.length;

      return {
        name: broker,
        quotationsCount: total,
        confirmedCount: confirmed,
        declinedCount: brokerQuotations.filter(
          (q: Quotation) => q.status === "Decline"
        ).length,
        openCount: brokerQuotations.filter(
          (q: Quotation) => q.status === "Open"
        ).length,
        hitRatio: total > 0 ? ((confirmed / total) * 100).toFixed(2) : 0,
        ordersCount: brokerOrders.length,
        premium: brokerOrders
          .reduce(
            (sum: number, o: Order) => sum + parseFloat(o.premium.toString()),
            0
          )
          .toFixed(2),
      };
    }) as BrokerAnalytics[];

    // Product analytics
    const productAnalytics: ProductAnalytics[] = productTypes.map((product) => {
      const productQuotations = filteredQuotations.filter(
        (q: Quotation) =>
          (isPropertyEngineering ? q.productType : q.marineProductType) ===
          product
      );
      const productOrders = filteredOrders.filter(
        (o: Order) =>
          (isPropertyEngineering ? o.productType : o.marineProductType) ===
          product
      );

      return {
        name: product,
        quotationsCount: productQuotations.length,
        confirmedCount: productQuotations.filter(
          (q: Quotation) => q.status === "Confirmed"
        ).length,
        premium: productOrders
          .reduce(
            (sum: number, o: Order) => sum + parseFloat(o.premium.toString()),
            0
          )
          .toFixed(2),
        avgPremium:
          productOrders.length > 0
            ? (
                productOrders.reduce(
                  (sum: number, o: Order) =>
                    sum + parseFloat(o.premium.toString()),
                  0
                ) / productOrders.length
              ).toFixed(2)
            : 0,
      };
    }) as ProductAnalytics[];

    // Business type analytics
    const businessTypeAnalytics: BusinessTypeAnalytics[] = businessTypes.map(
      (type) => {
        const typeOrders = filteredOrders.filter(
          (o: Order) => o.businessType === type
        );

        return {
          name: type,
          count: typeOrders.length,
          premium: typeOrders
            .reduce(
              (sum: number, o: Order) => sum + parseFloat(o.premium.toString()),
              0
            )
            .toFixed(2),
          avgPremium:
            typeOrders.length > 0
              ? (
                  typeOrders.reduce(
                    (sum: number, o: Order) =>
                      sum + parseFloat(o.premium.toString()),
                    0
                  ) / typeOrders.length
                ).toFixed(2)
              : 0,
        };
      }
    ) as BusinessTypeAnalytics[];

    // Time series data for trend analysis
    const timeSeriesData = (() => {
      if (!quotations || !orders) return [];

      // Create a map of dates within the range
      const dateMap = new Map<string, TimeSeriesData>();

      // If no date range is selected, use the last 30 days as default
      const end = endDate ? new Date(endDate) : new Date();
      const start = startDate ? new Date(startDate) : new Date(end);
      start.setDate(start.getDate() - (startDate ? 0 : 30)); // If no start date, go back 30 days

      // Initialize the date map with zeros
      for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
        const dateStr = format(d, "yyyy-MM-dd");
        dateMap.set(dateStr, {
          date: dateStr,
          newQuotations: 0,
          confirmedQuotations: 0,
          premium: 0,
        });
      }

      // Fill in quotation data - use all filtered quotations regardless of date if no date range
      filteredQuotations.forEach((q: Quotation) => {
        const dateStr = format(new Date(q.quotationDate), "yyyy-MM-dd");
        if (dateMap.has(dateStr)) {
          const entry = dateMap.get(dateStr)!;
          entry.newQuotations++;
          if (q.status === "Confirmed") {
            entry.confirmedQuotations++;
          }
        }
      });

      // Fill in order/premium data - use all filtered orders regardless of date if no date range
      filteredOrders.forEach((o: Order) => {
        const dateStr = format(new Date(o.orderDate), "yyyy-MM-dd");
        if (dateMap.has(dateStr)) {
          const entry = dateMap.get(dateStr)!;
          entry.premium += parseFloat(o.premium.toString());
        }
      });

      // Convert map to array and sort by date
      return Array.from(dateMap.values()).sort(
        (a: TimeSeriesData, b: TimeSeriesData) =>
          new Date(a.date).getTime() - new Date(b.date).getTime()
      );
    })();

    return {
      filteredQuotations,
      filteredOrders,
      brokers,
      productTypes,
      businessTypes,
      currentInsuredNames,
      overviewData,
      brokerAnalytics,
      productAnalytics,
      businessTypeAnalytics,
      timeSeriesData,
    };
  }, [
    quotations,
    orders,
    selectedBrokers,
    selectedProduct,
    selectedBusinessType,
    selectedInsured,
    isPropertyEngineering,
    startDate,
    endDate,
  ]);

  const isLoading =
    quotationsLoading ||
    ordersLoading ||
    (showCrossDepartmentView && insuredAnalyticsLoading);

  // Export data to Excel - Updated to properly filter by selected brokers
  const exportToExcel = async () => {
    try {
      const params = new URLSearchParams();

      if (startDate) {
        const start = new Date(startDate);
        start.setHours(0, 0, 0, 0);
        params.append("startDate", start.toISOString());
      }

      if (endDate) {
        const end = new Date(endDate);
        end.setHours(23, 59, 59, 999);
        params.append("endDate", end.toISOString());
      }

      // The backend expects a single 'broker' parameter, not 'brokers'
      if (!selectedBrokers.includes("all") && selectedBrokers.length === 1) {
        // If a single broker is selected, use the 'broker' parameter
        params.append("broker", selectedBrokers[0]);
        console.log(`Exporting data for broker: ${selectedBrokers[0]}`);
      } else if (
        !selectedBrokers.includes("all") &&
        selectedBrokers.length > 1
      ) {
        // For multiple brokers, we need to modify the backend to support this
        // For now, inform the user about the limitation
        toast({
          title: "Note",
          description:
            "Currently, Excel export is limited to one broker at a time. Using the first selected broker.",
          variant: "default",
        });
        params.append("broker", selectedBrokers[0]);
        console.log(
          `Exporting data for first broker: ${selectedBrokers[0]} (from selection of ${selectedBrokers.length} brokers)`
        );
      } else {
        console.log("Exporting data for all brokers");
      }

      if (selectedProduct !== "all") {
        params.append("product", selectedProduct);
      }

      if (selectedBusinessType !== "all") {
        params.append("businessType", selectedBusinessType);
      }

      // Add debugging log to see all params being sent
      console.log("Export params:", params.toString());

      toast({
        title: "Generating report",
        description: `Please wait while we prepare your Excel report${
          !selectedBrokers.includes("all")
            ? ` for ${selectedBrokers.join(", ")}`
            : ""
        }...`,
      });

      const response = await fetch(
        `/api/reports/management-export?${params.toString()}`,
        {
          credentials: "include",
        }
      );

      if (!response.ok) {
        console.error("Export failed with status:", response.status);
        throw new Error("Failed to generate report");
      }

      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      const dateStr =
        startDate && endDate
          ? `_${format(startDate, "dd-MM-yyyy")}_to_${format(
              endDate,
              "dd-MM-yyyy"
            )}`
          : "";

      // Include broker name in filename if filtering by specific broker(s)
      const brokerStr = !selectedBrokers.includes("all")
        ? `_${selectedBrokers.join("_")}`
        : "";

      a.download = `management_report${dateStr}${brokerStr}.xlsx`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);

      toast({
        title: "Success",
        description: `Management report${
          !selectedBrokers.includes("all")
            ? ` for ${selectedBrokers.join(", ")}`
            : ""
        } has been downloaded.`,
      });
    } catch (error) {
      console.error("Export error:", error);
      toast({
        title: "Error",
        description: "Failed to download report",
        variant: "destructive",
      });
    }
  };

  // Export data to PDF with enhanced quality and styling
  const exportToPdf = async () => {
    try {
      toast({
        title: "Preparing PDF",
        description: "Generating your enhanced report, please wait...",
      });

      // Force current tab to be visible to ensure charts render properly
      if (selectedTab !== "brokers") {
        setSelectedTab("brokers");
      }

      // Add a small delay to ensure DOM is updated and charts are rendered
      await new Promise((resolve) => setTimeout(resolve, 500));

      // Create PDF with high-quality settings
      const pdf = new jsPDF({
        orientation: "portrait",
        unit: "mm",
        format: "a4",
        compress: false, // Disable compression for better image quality
      });

      // Add a function to create consistent headers on each page
      const addPageHeader = (
        pageTitle = isPropertyEngineering
          ? "Property & Engineering Management Report"
          : "Marine Underwriting Management Report"
      ) => {
        pdf.setFillColor(0, 51, 102); // Dark blue header background
        pdf.rect(0, 0, 210, 20, "F");
        pdf.setTextColor(255, 255, 255); // White text
        pdf.setFont("helvetica", "bold");
        pdf.setFontSize(16);
        pdf.text(pageTitle, 10, 13);

        // Add company logo/icon placeholder
        pdf.setDrawColor(255, 255, 255);
        pdf.circle(195, 10, 6, "S");
        pdf.setFontSize(10);
        pdf.text("Logo", 191, 13);

        // Reset text color to black for content
        pdf.setTextColor(0, 0, 0);
        pdf.setFont("helvetica", "normal");
      };

      // Add a function to create consistent page footers
      const addPageFooter = (pageNumber: number, totalPages: number) => {
        pdf.setFontSize(8);
        pdf.setTextColor(100, 100, 100); // Dark gray text
        pdf.text(
          `Generated on ${format(new Date(), "dd MMM yyyy, HH:mm")}`,
          10,
          287
        );
        pdf.text(`Page ${pageNumber} of ${totalPages}`, 180, 287);
      };

      // Function to format currency with AED symbol
      const formatCurrency = (value: number | string) => {
        return `AED ${safeNumberFormat(value)}`;
      };

      // Prepare to capture all charts with high quality settings
      const chartPromises = [];
      if (!isLoading) {
        // Enhanced quality settings for chart capture
        const captureOptions = {
          quality: 1.0, // Maximum quality
          pixelRatio: 3, // Higher pixel ratio for sharper images (increased from 2)
          skipAutoScale: true, // Prevent automatic scaling
          style: {
            // Ensure charts render at high quality
            transform: "scale(1)",
            "transform-origin": "top left",
          },
          canvasWidth: 1200, // Set fixed width for better quality
          cacheBust: true, // Avoid caching issues
        };

        // Create better tabular data presentation for fallback
        const createTableData = (
          title: string,
          headers: string[],
          data: any[],
          formatter: (row: any) => string[]
        ) => {
          return {
            title,
            headers,
            rows: data.map(formatter),
          };
        };

        // Prepare broker table data
        const brokerTableData = createTableData(
          "Broker Performance - Hit Ratio",
          ["Broker Name", "Hit Ratio", "Confirmed", "Total", "Premium"],
          brokerAnalytics
            .sort(
              (a, b) =>
                parseFloat(b.hitRatio.toString()) -
                parseFloat(a.hitRatio.toString())
            )
            .slice(0, 8),
          (broker) => [
            broker.name,
            safeNumberFormat(broker.hitRatio, "", true),
            broker.confirmedCount.toString(),
            broker.quotationsCount.toString(),
            safeNumberFormat(broker.premium, "AED"),
          ]
        );

        // Prepare product table data
        const productTableData = createTableData(
          "Product Performance Analysis",
          ["Product", "Premium", "Avg Premium", "Confirmed", "Total"],
          productAnalytics
            .sort(
              (a, b) =>
                parseFloat(b.premium.toString()) -
                parseFloat(a.premium.toString())
            )
            .slice(0, 8),
          (product) => [
            product.name,
            safeNumberFormat(product.premium, "AED"),
            safeNumberFormat(product.avgPremium, "AED"),
            product.confirmedCount.toString(),
            product.quotationsCount.toString(),
          ]
        );

        // Ensure refs are properly defined before attempting capture
        const captureAndAddPromise = (
          ref: React.RefObject<HTMLDivElement>,
          type: string
        ) => {
          if (ref && ref.current) {
            // Make sure the element is visible and has dimensions
            const element = ref.current;
            if (element.offsetWidth > 0 && element.offsetHeight > 0) {
              const promise = toPng(element, captureOptions);
              chartPromises.push(
                promise.then((dataUrl) => ({ type, dataUrl }))
              );
              console.log(`Capturing chart: ${type}`);
            } else {
              console.warn(
                `Chart element for ${type} has zero dimensions, skipping capture`
              );
            }
          } else {
            console.warn(`Chart ref for ${type} is not available`);
          }
        };

        // Capture all charts with enhanced quality
        captureAndAddPromise(quotationStatusRef, "quotationStatus");
        captureAndAddPromise(premiumDistributionRef, "premiumDistribution");
        captureAndAddPromise(brokerPerformanceRef, "brokerPerformance");
        captureAndAddPromise(productPerformanceRef, "productPerformance");

        // Wait for all chart images to be ready
        const chartImages = await Promise.all(chartPromises);
        console.log(`Successfully captured ${chartImages.length} charts`);

        // Define number of pages and generate them all before adding content
        const totalPages = 3;

        // First pass: Create all pages with headers and footers
        for (let i = 1; i <= totalPages; i++) {
          if (i > 1) {
            pdf.addPage();
          }

          let pageTitle = isPropertyEngineering
            ? "Property & Engineering Management Report"
            : "Marine Underwriting Management Report";
          if (i === 2) pageTitle = "Performance Analysis";
          if (i === 3) pageTitle = "Broker & Product Analysis";

          addPageHeader(pageTitle);
          addPageFooter(i, totalPages);
        }

        // Page 1: Cover and Executive Summary
        pdf.setPage(1);
        let position = 30; // Start position after header

        // Title and date range
        pdf.setFont("helvetica", "bold");
        pdf.setFontSize(20);
        pdf.setTextColor(0, 51, 102); // Dark blue
        pdf.text("Management Report", 10, position);
        position += 15;

        // Add date range with subtle background
        pdf.setFillColor(240, 240, 250); // Light blue-gray background
        pdf.rect(10, position - 8, 190, 12, "F");
        pdf.setFontSize(12);
        pdf.setTextColor(0, 0, 0); // Black text
        const dateText = `Reporting Period: ${
          startDate ? format(startDate, "dd MMM yyyy") : "All"
        } to ${endDate ? format(endDate, "dd MMM yyyy") : "Present"}`;
        pdf.text(dateText, 15, position);
        position += 20;

        // Add filters section with improved styling
        pdf.setFillColor(245, 245, 245); // Light gray background
        pdf.rect(10, position - 5, 190, 25, "F");
        pdf.setFontSize(11);
        pdf.setFont("helvetica", "bold");
        pdf.text("Report Filters", 15, position);
        position += 8;

        pdf.setFont("helvetica", "normal");
        pdf.setFontSize(10);
        pdf.text(
          `Brokers: ${
            selectedBrokers.includes("all") ? "All" : selectedBrokers.join(", ")
          }`,
          15,
          position
        );
        position += 5;
        pdf.text(
          `Product: ${selectedProduct === "all" ? "All" : selectedProduct}`,
          15,
          position
        );
        position += 5;
        pdf.text(
          `Business Type: ${
            selectedBusinessType === "all" ? "All" : selectedBusinessType
          }`,
          100,
          position - 5
        );
        position += 15;

        // Executive summary section
        pdf.setFont("helvetica", "bold");
        pdf.setFontSize(14);
        pdf.setTextColor(0, 51, 102); // Dark blue
        pdf.text("Executive Summary", 10, position);
        position += 8;

        pdf.setFont("helvetica", "normal");
        pdf.setFontSize(10);
        pdf.setTextColor(60, 60, 60); // Dark gray text

        const summaryText = isPropertyEngineering
          ? "This report provides a comprehensive analysis of the property & engineering operations for the selected period. Key indicators show "
          : "This report provides a comprehensive analysis of the marine underwriting operations for the selected period. Key indicators show ";
        const performanceText =
          overviewData.confirmedQuotations > overviewData.declinedQuotations
            ? "positive performance with quotation confirmations exceeding declines."
            : "areas for improvement as decline rates are currently higher than confirmation rates.";

        pdf.text(summaryText + performanceText, 10, position, {
          maxWidth: 190,
        });
        position += 15;

        // KPI Overview with styled boxes
        const drawKpiBox = (
          x: number,
          y: number,
          width: number,
          title: string,
          value: string | number,
          subtitle: string | null,
          color: [number, number, number]
        ) => {
          // Box with border
          pdf.setDrawColor(200, 200, 200);
          pdf.setFillColor(250, 250, 250);
          pdf.roundedRect(x, y, width, 30, 3, 3, "FD");

          // Title
          pdf.setFont("helvetica", "normal");
          pdf.setFontSize(9);
          pdf.setTextColor(100, 100, 100);
          pdf.text(title, x + 5, y + 8);

          // Value
          pdf.setFont("helvetica", "bold");
          pdf.setFontSize(14);
          pdf.setTextColor(color[0], color[1], color[2]);
          pdf.text(String(value), x + 5, y + 20);

          // Subtitle if provided
          if (subtitle) {
            pdf.setFont("helvetica", "normal");
            pdf.setFontSize(8);
            pdf.setTextColor(120, 120, 120);
            pdf.text(subtitle, x + 5, y + 26);
          }
        };

        // KPI row 1
        drawKpiBox(
          10,
          position,
          60,
          "TOTAL QUOTATIONS",
          safeNumberFormat(overviewData.totalQuotations),
          null,
          [0, 51, 102]
        );
        drawKpiBox(
          75,
          position,
          60,
          "CONVERSION RATE",
          safeNumberFormat(overviewData.conversionRate, "", true),
          null,
          [46, 134, 193]
        );
        drawKpiBox(
          140,
          position,
          60,
          "TOTAL PREMIUM",
          formatCurrency(overviewData.totalPremium),
          null,
          [0, 102, 51]
        );
        position += 40;

        // KPI row 2
        drawKpiBox(
          10,
          position,
          60,
          "OPEN QUOTATIONS",
          safeNumberFormat(overviewData.openQuotations),
          null,
          [0, 136, 254]
        );
        drawKpiBox(
          75,
          position,
          60,
          "CONFIRMED",
          safeNumberFormat(overviewData.confirmedQuotations),
          null,
          [0, 196, 159]
        );
        drawKpiBox(
          140,
          position,
          60,
          "DECLINED",
          safeNumberFormat(overviewData.declinedQuotations),
          null,
          [255, 128, 66]
        );
        position += 40;

        // Page 2: Detailed Analysis
        pdf.setPage(2);
        position = 30; // Reset position for new page

        // Section: Quotation Status Chart
        pdf.setFillColor(245, 245, 245); // Light gray section background
        pdf.rect(10, position - 5, 190, 120, "F");

        pdf.setFont("helvetica", "bold");
        pdf.setFontSize(14);
        pdf.setTextColor(0, 51, 102); // Dark blue
        pdf.text("Quotation Status Distribution", 15, position + 5);
        position += 15;

        // Add the first chart with improved quality
        const quotationStatusChart = chartImages.find(
          (img) => img.type === "quotationStatus"
        );
        if (quotationStatusChart) {
          // Use higher quality settings for image insertion
          pdf.addImage(
            quotationStatusChart.dataUrl,
            "PNG",
            20,
            position,
            170,
            90,
            undefined,
            "FAST" // Use fast compression algorithm for better quality
          );
        } else {
          pdf.setFont("helvetica", "italic");
          pdf.setFontSize(12);
          pdf.setTextColor(150, 150, 150);
          pdf.text("Chart data unavailable", 80, position + 40);

          // Add a simple table showing quotation status
          position += 10;
          pdf.setFont("helvetica", "normal");
          pdf.setFontSize(10);
          pdf.setTextColor(0, 0, 0);

          const statuses = [
            {
              name: "Open",
              count: overviewData.openQuotations,
              color: STATUS_COLORS.Open,
            },
            {
              name: "Confirmed",
              count: overviewData.confirmedQuotations,
              color: STATUS_COLORS.Confirmed,
            },
            {
              name: "Declined",
              count: overviewData.declinedQuotations,
              color: STATUS_COLORS.Decline,
            },
          ];

          statuses.forEach((status, index) => {
            // Color box
            pdf.setFillColor(...hexToRgb(status.color));
            pdf.rect(30, position + index * 12, 8, 8, "F");

            // Text
            pdf.text(
              `${status.name}: ${safeNumberFormat(status.count)}`,
              45,
              position + index * 12 + 6
            );
          });
        }
        position += 100;

        // Section: Premium Distribution
        pdf.setFillColor(245, 245, 245); // Light gray section background
        pdf.rect(10, position - 5, 190, 120, "F");

        pdf.setFont("helvetica", "bold");
        pdf.setFontSize(14);
        pdf.setTextColor(0, 51, 102); // Dark blue
        pdf.text("Premium Distribution by Business Type", 15, position + 5);
        position += 15;

        // Add the premium distribution chart with improved quality
        const premiumChart = chartImages.find(
          (img) => img.type === "premiumDistribution"
        );
        if (premiumChart) {
          pdf.addImage(
            premiumChart.dataUrl,
            "PNG",
            20,
            position,
            170,
            90,
            undefined,
            "FAST"
          );
        } else {
          pdf.setFont("helvetica", "italic");
          pdf.setFontSize(12);
          pdf.setTextColor(150, 150, 150);
          pdf.text("Chart data unavailable", 80, position + 40);

          // Add a simple table showing premium distribution
          position += 10;
          pdf.setFont("helvetica", "normal");
          pdf.setFontSize(10);
          pdf.setTextColor(0, 0, 0);

          const premiumData = [
            {
              name: "New Business",
              value: overviewData.newBusinessPremium,
              color: STATUS_COLORS.NewBusiness,
            },
            {
              name: "Renewal",
              value: overviewData.renewalPremium,
              color: STATUS_COLORS.Renewal,
            },
          ];

          premiumData.forEach((item, index) => {
            // Color box
            pdf.setFillColor(...hexToRgb(item.color));
            pdf.rect(30, position + index * 12, 8, 8, "F");

            // Text
            pdf.text(
              `${item.name}: ${safeNumberFormat(item.value, "AED")}`,
              45,
              position + index * 12 + 6
            );
          });
        }

        // Page 3: Broker and Product Analysis
        pdf.setPage(3);
        position = 30; // Reset position for new page

        // Section: Broker Performance
        pdf.setFillColor(245, 245, 245); // Light gray section background
        pdf.rect(10, position - 5, 190, 210, "F");

        pdf.setFont("helvetica", "bold");
        pdf.setFontSize(14);
        pdf.setTextColor(0, 51, 102); // Dark blue
        pdf.text("Broker Performance - Hit Ratio", 15, position + 5);
        position += 15;

        // Add the broker performance chart with improved quality
        const brokerChart = chartImages.find(
          (img) => img.type === "brokerPerformance"
        );
        if (brokerChart) {
          pdf.addImage(
            brokerChart.dataUrl,
            "PNG",
            20,
            position,
            170,
            90,
            undefined,
            "FAST"
          );
          console.log("Successfully added broker performance chart to PDF");
        } else {
          // Draw broker table using the same table function
          position = drawTable(brokerTableData, 15, position, 180);
        }

        position += 20;

        // Section: Product Performance
        pdf.setFillColor(245, 245, 245); // Light gray section background
        pdf.rect(10, position - 5, 190, 155, "F");

        pdf.setFont("helvetica", "bold");
        pdf.setFontSize(14);
        pdf.setTextColor(0, 51, 102); // Dark blue
        pdf.text("Product Performance Analysis", 15, position + 5);
        position += 15;

        // Add the product performance chart with improved quality
        const productChart = chartImages.find(
          (img) => img.type === "productPerformance"
        );
        if (productChart) {
          pdf.addImage(
            productChart.dataUrl,
            "PNG",
            20,
            position,
            170,
            90,
            undefined,
            "FAST"
          );
          console.log("Successfully added product performance chart to PDF");
        } else {
          // Draw product table using the same table function
          position = drawTable(productTableData, 15, position, 180);
        }

        // Save the PDF
        const dateStr =
          startDate && endDate
            ? `_${format(startDate, "dd-MM-yyyy")}_to_${format(
                endDate,
                "dd-MM-yyyy"
              )}`
            : "";
        pdf.save(`marine_underwriting_report${dateStr}.pdf`);

        toast({
          title: "Success",
          description: "Enhanced management report PDF has been downloaded.",
        });
      }
    } catch (error) {
      console.error("PDF export error:", error);
      toast({
        title: "Error",
        description: "Failed to generate PDF report",
        variant: "destructive",
      });
    }
  };

  // Helper function to convert hex colors to RGB array
  function hexToRgb(hex: string): [number, number, number] {
    // Remove # if present
    hex = hex.replace("#", "");

    // Parse the hex values
    const r = parseInt(hex.substring(0, 2), 16);
    const g = parseInt(hex.substring(2, 4), 16);
    const b = parseInt(hex.substring(4, 6), 16);

    return [r, g, b];
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-gray-50 to-gray-100 dark:from-gray-900 dark:to-gray-800">
      <header className="bg-white dark:bg-gray-800 shadow-md border-b dark:border-gray-700 sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex justify-between items-center">
            <div className="flex items-center gap-3">
              {isPropertyEngineering ? (
                <Building className="h-8 w-8 text-blue-600 dark:text-blue-400" />
              ) : (
                <Ship className="h-8 w-8 text-blue-600 dark:text-blue-400" />
              )}
              <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
                {isPropertyEngineering
                  ? "Property & Engineering"
                  : "Marine Underwriting"}
              </h1>
            </div>
            <Link href="/">
              <Button variant="outline" size="sm" className="gap-2 shadow-sm hover:shadow dark:bg-gray-700 dark:border-gray-600 dark:text-gray-200 dark:hover:bg-gray-600">
                <ArrowLeft className="h-4 w-4" />
                Back to Dashboard
              </Button>
            </Link>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="space-y-6">
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
            <div>
              <h2 className="text-3xl font-bold text-gray-900 dark:text-white">
                Management Report
              </h2>
              <p className="mt-2 text-gray-600 dark:text-slate-400">
                Comprehensive business analytics and performance metrics
              </p>
            </div>
            <div className="flex space-x-2">
              <Button
                onClick={exportToExcel}
                className="bg-primary hover:bg-primary/90"
              >
                <FileDown className="h-4 w-4 mr-2" />
                Export to Excel
              </Button>
            </div>
          </div>

          {/* Filters Section */}
          <Card className="bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700 shadow-sm">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-gray-900 dark:text-white">
                <BarChart4 className="h-5 w-5 text-blue-400" />
                Report Filters
              </CardTitle>
              <CardDescription className="text-gray-600 dark:text-slate-400">
                Select parameters to customize your report
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              {/* Filters arranged in rows */}
              <div className="space-y-4">
                {/* First Row: Date Range */}
                <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4">
                  <div className="w-full sm:w-auto">
                    <p className="text-sm font-medium mb-2">Date Range</p>
                    <div className="flex items-center gap-2">
                      <Popover>
                        <PopoverTrigger asChild>
                          <Button
                            variant="outline"
                            className="w-[160px] justify-start text-left font-normal"
                          >
                            {startDate
                              ? format(startDate, "PPP")
                              : "Start date"}
                          </Button>
                        </PopoverTrigger>
                        <PopoverContent className="w-auto p-0" align="start">
                          <Calendar
                            mode="single"
                            selected={startDate}
                            onSelect={setStartDate}
                            initialFocus
                          />
                        </PopoverContent>
                      </Popover>

                      <Popover>
                        <PopoverTrigger asChild>
                          <Button
                            variant="outline"
                            className="w-[160px] justify-start text-left font-normal"
                          >
                            {endDate ? format(endDate, "PPP") : "End date"}
                          </Button>
                        </PopoverTrigger>
                        <PopoverContent className="w-auto p-0" align="start">
                          <Calendar
                            mode="single"
                            selected={endDate}
                            onSelect={setEndDate}
                            initialFocus
                          />
                        </PopoverContent>
                      </Popover>

                      {(startDate || endDate) && (
                        <Button
                          variant="ghost"
                          onClick={() => {
                            setStartDate(undefined);
                            setEndDate(undefined);
                          }}
                          className="h-10"
                        >
                          Reset
                        </Button>
                      )}
                    </div>
                  </div>
                </div>

                {/* Second Row: Broker and Product Filters */}
                <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4">
                  {/* Broker Filter */}
                  <div className="w-full sm:w-auto">
                    <p className="text-sm font-medium mb-2">Brokers</p>
                    <Popover>
                      <PopoverTrigger asChild>
                        <Button
                          variant="outline"
                          className="w-[250px] justify-between text-left"
                        >
                          <span className="truncate">
                            {selectedBrokers.includes("all")
                              ? "All Brokers"
                              : selectedBrokers.length > 1
                              ? `${selectedBrokers.length} brokers selected`
                              : selectedBrokers[0]}
                          </span>
                          <ChevronDown className="h-4 w-4 opacity-50" />
                        </Button>
                      </PopoverTrigger>
                      <PopoverContent className="w-[300px] p-0" align="start">
                        <Command className="h-[300px]">
                          <CommandInput placeholder="Search brokers..." />
                          <CommandEmpty>No broker found.</CommandEmpty>
                          <CommandGroup className="max-h-[240px] overflow-y-auto">
                            <CommandItem
                              onSelect={() => {
                                setSelectedBrokers(["all"]);
                              }}
                              className="cursor-pointer flex items-center gap-2"
                            >
                              <div
                                className={`h-4 w-4 border rounded-sm ${
                                  selectedBrokers.includes("all")
                                    ? "bg-primary border-primary"
                                    : "border-gray-300"
                                }`}
                              >
                                {selectedBrokers.includes("all") && (
                                  <Check className="h-3 w-3 text-white" />
                                )}
                              </div>
                              <span>All Brokers</span>
                            </CommandItem>
                            {brokers.map((broker: string) => (
                              <CommandItem
                                key={broker}
                                onSelect={() => {
                                  setSelectedBrokers((prev) => {
                                    // If "all" is selected and user selects a specific broker, remove "all"
                                    if (prev.includes("all")) {
                                      return [broker];
                                    }

                                    // If broker is already selected, remove it
                                    if (prev.includes(broker)) {
                                      const newSelection = prev.filter(
                                        (b) => b !== broker
                                      );
                                      // If nothing selected, default to "all"
                                      return newSelection.length
                                        ? newSelection
                                        : ["all"];
                                    }

                                    // Add broker to selection
                                    return [...prev, broker];
                                  });
                                }}
                                className="cursor-pointer flex items-center gap-2"
                              >
                                <div
                                  className={`h-4 w-4 border rounded-sm ${
                                    selectedBrokers.includes(broker)
                                      ? "bg-primary border-primary"
                                      : "border-gray-300"
                                  }`}
                                >
                                  {selectedBrokers.includes(broker) && (
                                    <Check className="h-3 w-3 text-white" />
                                  )}
                                </div>
                                <span>{broker}</span>
                              </CommandItem>
                            ))}
                          </CommandGroup>
                        </Command>
                      </PopoverContent>
                    </Popover>
                  </div>

                  {/* Product Type Filter */}
                  <div className="w-full sm:w-auto">
                    <p className="text-sm font-medium mb-2">Product Type</p>
                    <Select
                      value={selectedProduct}
                      onValueChange={setSelectedProduct}
                    >
                      <SelectTrigger className="w-[200px]">
                        <SelectValue placeholder="Select product" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">All Products</SelectItem>
                        {productTypes.map((product: string) => (
                          <SelectItem key={product} value={product}>
                            {product}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  {/* Business Type Filter */}
                  <div className="w-full sm:w-auto">
                    <p className="text-sm font-medium mb-2">Business Type</p>
                    <Select
                      value={selectedBusinessType}
                      onValueChange={setSelectedBusinessType}
                    >
                      <SelectTrigger className="w-[200px]">
                        <SelectValue placeholder="Select type" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">All Types</SelectItem>
                        {businessTypes.map((type: string) => (
                          <SelectItem key={type} value={type}>
                            {type}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                {/* Third Row: Insured Name Filter */}
                <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4">
                  <div className="w-full sm:w-auto">
                    <p className="text-sm font-medium mb-2">Insured Name</p>
                    <Popover>
                      <PopoverTrigger asChild>
                        <Button
                          variant="outline"
                          className="w-[350px] justify-between text-left"
                        >
                          <span className="truncate">
                            {selectedInsured.includes("all")
                              ? "All Insured"
                              : selectedInsured.length > 1
                              ? `${selectedInsured.length} insured selected`
                              : selectedInsured[0]}
                          </span>
                          <ChevronDown className="h-4 w-4 opacity-50" />
                        </Button>
                      </PopoverTrigger>
                      <PopoverContent className="w-[400px] p-0" align="start">
                        <Command className="h-[350px]">
                          <CommandInput placeholder="Search insured companies..." />
                          <CommandEmpty>No insured company found.</CommandEmpty>
                          <CommandGroup className="max-h-[290px] overflow-y-auto">
                            <CommandItem
                              onSelect={() => {
                                setSelectedInsured(["all"]);
                                setShowCrossDepartmentView(false);
                              }}
                              className="cursor-pointer flex items-center gap-2"
                            >
                              <div
                                className={`h-4 w-4 border rounded-sm ${
                                  selectedInsured.includes("all")
                                    ? "bg-primary border-primary"
                                    : "border-gray-300"
                                }`}
                              >
                                {selectedInsured.includes("all") && (
                                  <Check className="h-3 w-3 text-white" />
                                )}
                              </div>
                              <span>All Insured</span>
                            </CommandItem>
                            {/* Show cross-department insured names when available, otherwise current department names */}
                            {(insuredNames && insuredNames.length > 0
                              ? insuredNames
                              : currentInsuredNames
                            )?.map((name: string) => (
                              <CommandItem
                                key={name}
                                onSelect={() => {
                                  setSelectedInsured((prev) => {
                                    // If "all" is selected and user selects a specific insured, remove "all"
                                    if (prev.includes("all")) {
                                      setShowCrossDepartmentView(true);
                                      return [name];
                                    }

                                    // If insured is already selected, remove it
                                    if (prev.includes(name)) {
                                      const newSelection = prev.filter(
                                        (i) => i !== name
                                      );
                                      // If nothing selected, default to "all"
                                      if (newSelection.length === 0) {
                                        setShowCrossDepartmentView(false);
                                        return ["all"];
                                      }
                                      return newSelection;
                                    }

                                    // Add insured to selection
                                    return [...prev, name];
                                  });
                                }}
                                className="cursor-pointer flex items-center gap-2"
                              >
                                <div
                                  className={`h-4 w-4 border rounded-sm ${
                                    selectedInsured.includes(name)
                                      ? "bg-primary border-primary"
                                      : "border-gray-300"
                                  }`}
                                >
                                  {selectedInsured.includes(name) && (
                                    <Check className="h-3 w-3 text-white" />
                                  )}
                                </div>
                                <span className="truncate">{name}</span>
                              </CommandItem>
                            ))}
                          </CommandGroup>
                        </Command>
                      </PopoverContent>
                    </Popover>
                  </div>
                </div>
              </div>

              {/* Cross-Department View Toggle */}
              {!selectedInsured.includes("all") &&
                selectedInsured.length > 0 && (
                  <div className="mt-4 p-4 bg-blue-50 border border-blue-200 rounded-lg">
                    <div className="flex items-center justify-between">
                      <div>
                        <h4 className="text-sm font-medium text-blue-900">
                          Cross-Department Analytics for{" "}
                          {selectedInsured.length === 1
                            ? selectedInsured[0]
                            : `${selectedInsured.length} selected companies`}
                        </h4>
                        <p className="text-xs text-blue-700 mt-1">
                          View production across Marine, Property & Engineering,
                          and Liability departments
                        </p>
                      </div>
                      <Button
                        variant={
                          showCrossDepartmentView ? "default" : "outline"
                        }
                        size="sm"
                        onClick={() =>
                          setShowCrossDepartmentView(!showCrossDepartmentView)
                        }
                      >
                        {showCrossDepartmentView ? "Hide" : "Show"} Cross-Dept
                        View
                      </Button>
                    </div>
                  </div>
                )}
            </CardContent>
          </Card>

          {isLoading ? (
            <Card className="bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700 shadow-sm">
              <CardContent className="flex justify-center items-center py-12">
                <div className="flex flex-col items-center gap-4">
                  <RefreshCw className="h-12 w-12 animate-spin text-primary" />
                  <p className="text-lg font-medium text-gray-600 dark:text-slate-400">
                    Loading report data...
                  </p>
                </div>
              </CardContent>
            </Card>
          ) : (
            <>
              {/* Cross-Department View for Selected Insured Companies */}
              {showCrossDepartmentView &&
                insuredAnalytics &&
                insuredAnalytics.length > 0 && (
                  <div className="space-y-6 mb-6">
                    {insuredAnalytics.map((analytics, index) => (
                      <Card key={analytics.insuredName} className="bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700 shadow-sm">
                        <CardHeader>
                          <CardTitle className="text-xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
                            <Building className="h-6 w-6 text-primary" />
                            Cross-Department Analytics: {analytics.insuredName}
                          </CardTitle>
                          <CardDescription>
                            Production overview across all departments for this
                            insured
                          </CardDescription>
                        </CardHeader>
                        <CardContent>
                          {/* Total Summary */}
                          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-6">
                            <Card className="bg-blue-50 border-blue-200">
                              <CardHeader className="pb-2">
                                <CardTitle className="text-lg font-medium text-blue-900">
                                  Total Quotations
                                </CardTitle>
                              </CardHeader>
                              <CardContent>
                                <div className="space-y-2">
                                  <div className="text-2xl font-bold text-blue-900">
                                    {analytics.totals.quotations.total}
                                  </div>
                                  <div className="text-sm text-blue-700">
                                    Estimated Premium: AED{" "}
                                    {safeNumberFormat(
                                      analytics.totals.quotations
                                        .estimatedPremium
                                    )}
                                  </div>
                                </div>
                              </CardContent>
                            </Card>

                            <Card className="bg-green-50 border-green-200">
                              <CardHeader className="pb-2">
                                <CardTitle className="text-lg font-medium text-green-900">
                                  Total Orders
                                </CardTitle>
                              </CardHeader>
                              <CardContent>
                                <div className="space-y-2">
                                  <div className="text-2xl font-bold text-green-900">
                                    {analytics.totals.orders.total}
                                  </div>
                                  <div className="text-sm text-green-700">
                                    Total Premium: AED{" "}
                                    {safeNumberFormat(
                                      analytics.totals.orders.totalPremium
                                    )}
                                  </div>
                                </div>
                              </CardContent>
                            </Card>

                            <Card className="bg-purple-50 border-purple-200">
                              <CardHeader className="pb-2">
                                <CardTitle className="text-lg font-medium text-purple-900">
                                  Conversion Rate
                                </CardTitle>
                              </CardHeader>
                              <CardContent>
                                <div className="space-y-2">
                                  <div className="text-2xl font-bold text-purple-900">
                                    {analytics.totals.quotations.total > 0
                                      ? (
                                          (analytics.totals.quotations
                                            .confirmed /
                                            analytics.totals.quotations.total) *
                                          100
                                        ).toFixed(1)
                                      : 0}
                                    %
                                  </div>
                                  <div className="text-sm text-purple-700">
                                    {analytics.totals.quotations.confirmed} of{" "}
                                    {analytics.totals.quotations.total}{" "}
                                    confirmed
                                  </div>
                                </div>
                              </CardContent>
                            </Card>
                          </div>

                          {/* Department Breakdown */}
                          <div className="space-y-4">
                            <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
                              Department Breakdown
                            </h3>
                            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                              {analytics.departments.map((dept, deptIndex) => (
                                <Card
                                  key={`${analytics.insuredName}-${dept.department}`}
                                  className="border-2"
                                >
                                  <CardHeader>
                                    <CardTitle className="text-lg font-medium text-gray-900 dark:text-white flex items-center gap-2">
                                      {dept.department === "Marine" ? (
                                        <Ship className="h-5 w-5 text-blue-600" />
                                      ) : (
                                        <Building className="h-5 w-5 text-green-600" />
                                      )}
                                      {dept.department}
                                    </CardTitle>
                                  </CardHeader>
                                  <CardContent>
                                    <div className="space-y-4">
                                      <div>
                                        <h4 className="font-medium text-gray-700 dark:text-slate-300 mb-2">
                                          Quotations
                                        </h4>
                                        <div className="grid grid-cols-2 gap-4 text-sm">
                                          <div>
                                            Total:{" "}
                                            <span className="font-semibold">
                                              {dept.quotations.total}
                                            </span>
                                          </div>
                                          <div>
                                            Open:{" "}
                                            <span className="font-semibold text-blue-600">
                                              {dept.quotations.open}
                                            </span>
                                          </div>
                                          <div>
                                            Confirmed:{" "}
                                            <span className="font-semibold text-green-600">
                                              {dept.quotations.confirmed}
                                            </span>
                                          </div>
                                          <div>
                                            Declined:{" "}
                                            <span className="font-semibold text-red-600">
                                              {dept.quotations.declined}
                                            </span>
                                          </div>
                                        </div>
                                        <div className="mt-2 text-sm">
                                          Est. Premium:{" "}
                                          <span className="font-semibold">
                                            AED{" "}
                                            {safeNumberFormat(
                                              dept.quotations.estimatedPremium
                                            )}
                                          </span>
                                        </div>
                                      </div>

                                      <div>
                                        <h4 className="font-medium text-gray-700 dark:text-slate-300 mb-2">
                                          Orders
                                        </h4>
                                        <div className="grid grid-cols-2 gap-4 text-sm">
                                          <div>
                                            Total:{" "}
                                            <span className="font-semibold">
                                              {dept.orders.total}
                                            </span>
                                          </div>
                                          <div>
                                            New Business:{" "}
                                            <span className="font-semibold text-purple-600">
                                              {dept.orders.newBusiness}
                                            </span>
                                          </div>
                                          <div>
                                            Renewal:{" "}
                                            <span className="font-semibold text-orange-600">
                                              {dept.orders.renewal}
                                            </span>
                                          </div>
                                        </div>
                                        <div className="mt-2 text-sm">
                                          Total Premium:{" "}
                                          <span className="font-semibold">
                                            AED{" "}
                                            {safeNumberFormat(
                                              dept.orders.totalPremium
                                            )}
                                          </span>
                                        </div>
                                      </div>
                                    </div>
                                  </CardContent>
                                </Card>
                              ))}
                            </div>
                          </div>
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                )}

              {/* Report Navigation - Improved Styling */}
              <Tabs
                value={selectedTab}
                onValueChange={setSelectedTab}
                className="w-full"
              >
                <TabsList className="w-full mb-6 bg-gray-100 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-1 h-auto shadow-sm grid grid-cols-4">
                  <TabsTrigger
                    value="overview"
                    className="flex items-center justify-center gap-2 py-3 data-[state=active]:bg-primary data-[state=active]:text-white"
                  >
                    <BarChart4 className="h-4 w-4" />
                    <span>Overview</span>
                  </TabsTrigger>
                  <TabsTrigger
                    value="brokers"
                    className="flex items-center justify-center gap-2 py-3 data-[state=active]:bg-primary data-[state=active]:text-white"
                  >
                    <Users className="h-4 w-4" />
                    <span>Broker Analysis</span>
                  </TabsTrigger>
                  <TabsTrigger
                    value="products"
                    className="flex items-center justify-center gap-2 py-3 data-[state=active]:bg-primary data-[state=active]:text-white"
                  >
                    <Package className="h-4 w-4" />
                    <span>Product Analysis</span>
                  </TabsTrigger>
                  <TabsTrigger
                    value="trends"
                    className="flex items-center justify-center gap-2 py-3 data-[state=active]:bg-primary data-[state=active]:text-white"
                  >
                    <TrendingUp className="h-4 w-4" />
                    <span>Trend Analysis</span>
                  </TabsTrigger>
                </TabsList>

                {/* Overview Tab */}
                <TabsContent value="overview" className="space-y-6">
                  {/* KPI Cards */}
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                    <Card className="bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700 shadow-sm hover:shadow-lg transition-shadow">
                      <CardHeader className="pb-2">
                        <CardTitle className="text-lg font-medium text-gray-900 dark:text-white flex items-center gap-2">
                          <BarChart className="h-5 w-5 text-primary" />
                          Quotation Metrics
                        </CardTitle>
                      </CardHeader>
                      <CardContent>
                        <div className="space-y-4">
                          <div className="flex justify-between items-center">
                            <span className="text-sm text-gray-600 dark:text-slate-400">
                              Total Quotations
                            </span>
                            <span className="text-lg font-semibold">
                              {safeNumberFormat(overviewData.totalQuotations)}
                            </span>
                          </div>
                          <div className="flex justify-between items-center">
                            <span className="text-sm text-gray-600 dark:text-slate-400">
                              Open Quotations
                            </span>
                            <span className="text-lg font-semibold">
                              {safeNumberFormat(overviewData.openQuotations)}
                            </span>
                          </div>
                          <div className="flex justify-between items-center">
                            <span className="text-sm text-gray-600 dark:text-slate-400">
                              Confirmed Quotations
                            </span>
                            <span className="text-lg font-semibold">
                              {safeNumberFormat(
                                overviewData.confirmedQuotations
                              )}
                            </span>
                          </div>
                          <div className="flex justify-between items-center">
                            <span className="text-sm text-gray-600 dark:text-slate-400">
                              Declined Quotations
                            </span>
                            <span className="text-lg font-semibold">
                              {safeNumberFormat(
                                overviewData.declinedQuotations
                              )}
                            </span>
                          </div>
                          <div className="flex justify-between items-center">
                            <span className="text-sm text-gray-600 dark:text-slate-400">
                              Conversion Rate
                            </span>
                            <span className="text-lg font-semibold">
                              {safeNumberFormat(
                                overviewData.conversionRate,
                                "",
                                true
                              )}
                            </span>
                          </div>
                          <div className="flex justify-between items-center">
                            <span className="text-sm text-gray-600 dark:text-slate-400">
                              Avg. Estimated Premium
                            </span>
                            <span className="text-lg font-semibold">
                              {safeNumberFormat(
                                overviewData.avgEstimatedPremium
                              )}{" "}
                              AED
                            </span>
                          </div>
                        </div>
                      </CardContent>
                    </Card>

                    <Card className="bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700 shadow-sm hover:shadow-lg transition-shadow">
                      <CardHeader className="pb-2">
                        <CardTitle className="text-lg font-medium text-gray-900 dark:text-white flex items-center gap-2">
                          <PieChart className="h-5 w-5 text-primary" />
                          Order Metrics
                        </CardTitle>
                      </CardHeader>
                      <CardContent>
                        <div className="space-y-4">
                          <div className="flex justify-between items-center">
                            <span className="text-sm text-gray-600 dark:text-slate-400">
                              Total Orders
                            </span>
                            <span className="text-lg font-semibold">
                              {safeNumberFormat(overviewData.totalOrdersCount)}
                            </span>
                          </div>
                          <div className="flex justify-between items-center">
                            <span className="text-sm text-gray-600 dark:text-slate-400">
                              Total Premium
                            </span>
                            <span className="text-lg font-semibold">
                              AED {safeNumberFormat(overviewData.totalPremium)}
                            </span>
                          </div>
                          <div className="flex justify-between items-center">
                            <span className="text-sm text-gray-600 dark:text-slate-400">
                              New Business Orders
                            </span>
                            <span className="text-lg font-semibold">
                              {safeNumberFormat(overviewData.newBusinessCount)}
                            </span>
                          </div>
                          <div className="flex justify-between items-center">
                            <span className="text-sm text-gray-600 dark:text-slate-400">
                              Renewal Orders
                            </span>
                            <span className="text-lg font-semibold">
                              {safeNumberFormat(overviewData.renewalCount)}
                            </span>
                          </div>
                          <div className="flex justify-between items-center">
                            <span className="text-sm text-gray-600 dark:text-slate-400">
                              New Business Premium
                            </span>
                            <span className="text-lg font-semibold">
                              AED{" "}
                              {safeNumberFormat(
                                overviewData.newBusinessPremium
                              )}
                            </span>
                          </div>
                          <div className="flex justify-between items-center">
                            <span className="text-sm text-gray-600 dark:text-slate-400">
                              Renewal Premium
                            </span>
                            <span className="text-lg font-semibold">
                              AED{" "}
                              {safeNumberFormat(overviewData.renewalPremium)}
                            </span>
                          </div>
                        </div>
                      </CardContent>
                    </Card>

                    <Card className="bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700 shadow-sm hover:shadow-lg transition-shadow">
                      <CardHeader className="pb-2">
                        <CardTitle className="text-lg font-medium text-gray-900 dark:text-white flex items-center gap-2">
                          <PieChart className="h-5 w-5 text-primary" />
                          Premium Distribution
                        </CardTitle>
                      </CardHeader>
                      <CardContent
                        className="p-0 h-[300px]"
                        ref={premiumDistributionRef}
                      >
                        <ResponsiveContainer width="100%" height="100%">
                          <RePieChart>
                            <Pie
                              data={[
                                {
                                  name: "New Business",
                                  value: parseFloat(
                                    String(overviewData.newBusinessPremium)
                                  ),
                                },
                                {
                                  name: "Renewal",
                                  value: parseFloat(
                                    String(overviewData.renewalPremium)
                                  ),
                                },
                              ]}
                              cx="50%"
                              cy="50%"
                              innerRadius={60}
                              outerRadius={90}
                              paddingAngle={5}
                              dataKey="value"
                              label={({ name, percent }) =>
                                `${name}: ${(percent * 100).toFixed(0)}%`
                              }
                            >
                              <Cell fill={STATUS_COLORS.NewBusiness} />
                              <Cell fill={STATUS_COLORS.Renewal} />
                            </Pie>
                            <Tooltip
                              formatter={(value: any) =>
                                safeNumberFormat(value, "AED")
                              }
                            />
                            <Legend
                              verticalAlign="bottom"
                              height={36}
                              layout="horizontal"
                            />
                          </RePieChart>
                        </ResponsiveContainer>
                      </CardContent>
                    </Card>
                  </div>

                  {/* Quotation Status Chart */}
                  <Card className="bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700 shadow-sm hover:shadow-lg transition-shadow">
                    <CardHeader>
                      <CardTitle className="text-lg font-medium text-gray-900 dark:text-white flex items-center gap-2">
                        <BarChart className="h-5 w-5 text-primary" />
                        Quotation Status Distribution
                      </CardTitle>
                    </CardHeader>
                    <CardContent
                      className="p-2 h-[400px]"
                      ref={quotationStatusRef}
                    >
                      <ResponsiveContainer width="100%" height="100%">
                        <BarChart
                          data={[
                            {
                              name: "Open",
                              value: overviewData.openQuotations,
                            },
                            {
                              name: "Confirmed",
                              value: overviewData.confirmedQuotations,
                            },
                            {
                              name: "Declined",
                              value: overviewData.declinedQuotations,
                            },
                          ]}
                          margin={{ top: 20, right: 30, left: 20, bottom: 5 }}
                        >
                          <CartesianGrid strokeDasharray="3 3" />
                          <XAxis dataKey="name" />
                          <YAxis />
                          <Tooltip
                            formatter={(value: any) =>
                              safeNumberFormat(value, "AED")
                            }
                          />
                          <Legend />
                          <Bar dataKey="value" name="Count">
                            {[
                              <Cell key="open" fill={STATUS_COLORS.Open} />,
                              <Cell
                                key="confirmed"
                                fill={STATUS_COLORS.Confirmed}
                              />,
                              <Cell
                                key="declined"
                                fill={STATUS_COLORS.Decline}
                              />,
                            ]}
                          </Bar>
                        </BarChart>
                      </ResponsiveContainer>
                    </CardContent>
                  </Card>
                </TabsContent>

                {/* Broker Analysis Tab */}
                <TabsContent value="brokers" className="space-y-6">
                  <Card className="bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700 shadow-sm hover:shadow-lg transition-shadow">
                    <CardHeader>
                      <CardTitle className="text-lg font-medium text-gray-900 dark:text-white flex items-center gap-2">
                        <Users className="h-5 w-5 text-primary" />
                        Broker Performance - Hit Ratio
                      </CardTitle>
                      <CardDescription>
                        Conversion rate of quotations to confirmed orders by
                        broker
                      </CardDescription>
                    </CardHeader>
                    <CardContent
                      className="p-2 h-[400px]"
                      ref={brokerPerformanceRef}
                    >
                      <ResponsiveContainer width="100%" height="100%">
                        <BarChart
                          data={brokerAnalytics.sort(
                            (a: BrokerAnalytics, b: BrokerAnalytics) =>
                              parseFloat(b.hitRatio.toString()) -
                              parseFloat(a.hitRatio.toString())
                          )}
                          margin={{ top: 20, right: 30, left: 20, bottom: 60 }}
                        >
                          <CartesianGrid strokeDasharray="3 3" />
                          <XAxis
                            dataKey="name"
                            angle={-45}
                            textAnchor="end"
                            height={80}
                          />
                          <YAxis
                            label={{
                              value: "Hit Ratio (%)",
                              angle: -90,
                              position: "insideLeft",
                            }}
                          />
                          <Tooltip
                            formatter={(value: any) =>
                              safeNumberFormat(value, "", true)
                            }
                          />
                          <Legend />
                          <Bar
                            dataKey="hitRatio"
                            name="Hit Ratio %"
                            fill={STATUS_COLORS.Confirmed}
                          />
                        </BarChart>
                      </ResponsiveContainer>
                    </CardContent>
                  </Card>

                  <Card className="bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700 shadow-sm hover:shadow-lg transition-shadow">
                    <CardHeader>
                      <CardTitle className="text-lg font-medium text-gray-900 dark:text-white flex items-center gap-2">
                        <PieChart className="h-5 w-5 text-primary" />
                        Broker Premium Generation
                      </CardTitle>
                      <CardDescription>
                        Total premium generated by each broker
                      </CardDescription>
                    </CardHeader>
                    <CardContent className="p-2 h-[400px]">
                      <ResponsiveContainer width="100%" height="100%">
                        <BarChart
                          data={brokerAnalytics.sort(
                            (a: BrokerAnalytics, b: BrokerAnalytics) =>
                              parseFloat(b.premium.toString()) -
                              parseFloat(a.premium.toString())
                          )}
                          margin={{ top: 20, right: 30, left: 20, bottom: 60 }}
                        >
                          <CartesianGrid strokeDasharray="3 3" />
                          <XAxis
                            dataKey="name"
                            angle={-45}
                            textAnchor="end"
                            height={80}
                          />
                          <YAxis
                            label={{
                              value: "Premium (AED)",
                              angle: -90,
                              position: "insideLeft",
                            }}
                          />
                          <Tooltip
                            formatter={(value: any) =>
                              safeNumberFormat(value, "AED")
                            }
                          />
                          <Legend />
                          <Bar
                            dataKey="premium"
                            name="Premium (AED)"
                            fill="#8884d8"
                          />
                        </BarChart>
                      </ResponsiveContainer>
                    </CardContent>
                  </Card>

                  <Card className="bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700 shadow-sm hover:shadow-lg transition-shadow">
                    <CardHeader>
                      <CardTitle className="text-lg font-medium text-gray-900 dark:text-white flex items-center gap-2">
                        <BarChart4 className="h-5 w-5 text-primary" />
                        Broker Quotation Status Breakdown
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="p-2 h-[400px]">
                      <ResponsiveContainer width="100%" height="100%">
                        <BarChart
                          data={brokerAnalytics.filter(
                            (b: BrokerAnalytics) => b.quotationsCount > 0
                          )}
                          margin={{ top: 20, right: 30, left: 20, bottom: 60 }}
                        >
                          <CartesianGrid strokeDasharray="3 3" />
                          <XAxis
                            dataKey="name"
                            angle={-45}
                            textAnchor="end"
                            height={80}
                          />
                          <YAxis
                            label={{
                              value: "Count",
                              angle: -90,
                              position: "insideLeft",
                            }}
                          />
                          <Tooltip
                            formatter={(value: any) =>
                              safeNumberFormat(value, "AED")
                            }
                          />
                          <Legend />
                          <Bar
                            dataKey="confirmedCount"
                            name="Confirmed"
                            stackId="a"
                            fill={STATUS_COLORS.Confirmed}
                          />
                          <Bar
                            dataKey="openCount"
                            name="Open"
                            stackId="a"
                            fill={STATUS_COLORS.Open}
                          />
                          <Bar
                            dataKey="declinedCount"
                            name="Declined"
                            stackId="a"
                            fill={STATUS_COLORS.Decline}
                          />
                        </BarChart>
                      </ResponsiveContainer>
                    </CardContent>
                  </Card>
                </TabsContent>

                {/* Product Analysis Tab */}
                <TabsContent value="products" className="space-y-6">
                  <Card className="bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700 shadow-sm hover:shadow-lg transition-shadow">
                    <CardHeader>
                      <CardTitle className="text-lg font-medium text-gray-900 dark:text-white flex items-center gap-2">
                        <PieChart className="h-5 w-5 text-primary" />
                        Product Premium Generation
                      </CardTitle>
                    </CardHeader>
                    <CardContent
                      className="p-2 h-[400px]"
                      ref={productPerformanceRef}
                    >
                      <ResponsiveContainer width="100%" height="100%">
                        <BarChart
                          data={productAnalytics.sort(
                            (a: ProductAnalytics, b: ProductAnalytics) =>
                              parseFloat(b.premium.toString()) -
                              parseFloat(a.premium.toString())
                          )}
                          margin={{ top: 20, right: 30, left: 20, bottom: 60 }}
                        >
                          <CartesianGrid strokeDasharray="3 3" />
                          <XAxis
                            dataKey="name"
                            angle={-45}
                            textAnchor="end"
                            height={80}
                          />
                          <YAxis
                            label={{
                              value: "Premium (AED)",
                              angle: -90,
                              position: "insideLeft",
                            }}
                          />
                          <Tooltip
                            formatter={(value: any) =>
                              safeNumberFormat(value, "AED")
                            }
                          />
                          <Legend />
                          <Bar
                            dataKey="premium"
                            name="Total Premium"
                            fill="#0088FE"
                          />
                        </BarChart>
                      </ResponsiveContainer>
                    </CardContent>
                  </Card>

                  <Card className="bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700 shadow-sm hover:shadow-lg transition-shadow">
                    <CardHeader>
                      <CardTitle className="text-lg font-medium text-gray-900 dark:text-white flex items-center gap-2">
                        <BarChart4 className="h-5 w-5 text-primary" />
                        Product Quotation Volume vs Confirmation Rate
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="p-2 h-[400px]">
                      <ResponsiveContainer width="100%" height="100%">
                        <BarChart
                          data={productAnalytics.filter(
                            (p: ProductAnalytics) => p.quotationsCount > 0
                          )}
                          margin={{ top: 20, right: 30, left: 20, bottom: 60 }}
                        >
                          <CartesianGrid strokeDasharray="3 3" />
                          <XAxis
                            dataKey="name"
                            angle={-45}
                            textAnchor="end"
                            height={80}
                          />
                          <YAxis
                            yAxisId="left"
                            label={{
                              value: "Count",
                              angle: -90,
                              position: "insideLeft",
                            }}
                          />
                          <YAxis
                            yAxisId="right"
                            orientation="right"
                            label={{
                              value: "Confirmation %",
                              angle: 90,
                              position: "insideRight",
                            }}
                            domain={[0, 100]}
                          />
                          <Tooltip
                            formatter={(value: any, name: string) => {
                              if (name === "Confirmation Rate %") {
                                return [`${value.toFixed(2)}%`, name];
                              }
                              return [value, name];
                            }}
                          />
                          <Legend />
                          <Bar
                            dataKey="quotationsCount"
                            name="Total Quotations"
                            yAxisId="left"
                            fill="#8884d8"
                          />
                          <Bar
                            dataKey="confirmedCount"
                            name="Confirmed Quotations"
                            yAxisId="left"
                            fill="#82ca9d"
                          />
                          <Line
                            type="monotone"
                            dataKey={(data: any) =>
                              data.quotationsCount > 0
                                ? (data.confirmedCount / data.quotationsCount) *
                                  100
                                : 0
                            }
                            name="Confirmation Rate %"
                            yAxisId="right"
                            stroke="#ff7300"
                            strokeWidth={2}
                          />
                        </BarChart>
                      </ResponsiveContainer>
                    </CardContent>
                  </Card>

                  <Card className="bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700 shadow-sm hover:shadow-lg transition-shadow">
                    <CardHeader>
                      <CardTitle className="text-lg font-medium text-gray-900 dark:text-white flex items-center gap-2">
                        <PieChart className="h-5 w-5 text-primary" />
                        Product Premium Distribution
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="p-2 h-[400px]">
                      <ResponsiveContainer width="100%" height="100%">
                        <RePieChart
                          margin={{ top: 20, right: 30, left: 20, bottom: 60 }}
                        >
                          <Pie
                            data={productAnalytics.map(
                              (item: ProductAnalytics, index: number) => ({
                                name: item.name,
                                value: parseFloat(String(item.premium)),
                              })
                            )}
                            cx="50%"
                            cy="40%"
                            outerRadius={100}
                            fill="#8884d8"
                            dataKey="value"
                            nameKey="name"
                            labelLine={true}
                            label={({ name, percent }) =>
                              percent > 0.05
                                ? `${name}: ${(percent * 100).toFixed(0)}%`
                                : ""
                            }
                          >
                            {productAnalytics.map(
                              (entry: ProductAnalytics, index: number) => (
                                <Cell
                                  key={`cell-${index}`}
                                  fill={COLORS[index % COLORS.length]}
                                />
                              )
                            )}
                          </Pie>
                          <Tooltip
                            formatter={(value: any) =>
                              safeNumberFormat(value, "AED")
                            }
                          />
                          <Legend
                            verticalAlign="bottom"
                            height={36}
                            layout="horizontal"
                          />
                        </RePieChart>
                      </ResponsiveContainer>
                    </CardContent>
                  </Card>
                </TabsContent>

                {/* Trend Analysis Tab */}
                <TabsContent value="trends" className="space-y-6">
                  <Card className="bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700 shadow-sm hover:shadow-lg transition-shadow">
                    <CardHeader>
                      <CardTitle className="text-lg font-medium text-gray-900 dark:text-white flex items-center gap-2">
                        <LineChart className="h-5 w-5 text-primary" />
                        Daily Quotation Trend
                      </CardTitle>
                      <CardDescription>
                        Quotation volume over time for the selected period
                      </CardDescription>
                    </CardHeader>
                    <CardContent className="p-2 h-[400px]">
                      {timeSeriesData && timeSeriesData.length > 0 ? (
                        <ResponsiveContainer width="100%" height="100%">
                          <AreaChart
                            data={timeSeriesData}
                            margin={{ top: 20, right: 30, left: 20, bottom: 5 }}
                          >
                            <CartesianGrid strokeDasharray="3 3" />
                            <XAxis
                              dataKey="date"
                              tickFormatter={(date) =>
                                format(new Date(date), "dd MMM")
                              }
                            />
                            <YAxis />
                            <Tooltip
                              labelFormatter={(label) =>
                                format(new Date(label), "dd MMM yyyy")
                              }
                              formatter={(value: any) => [value, "Count"]}
                            />
                            <Legend />
                            <Area
                              type="monotone"
                              dataKey="newQuotations"
                              name="New Quotations"
                              stroke="#8884d8"
                              fill="#8884d8"
                            />
                            <Area
                              type="monotone"
                              dataKey="confirmedQuotations"
                              name="Confirmed Quotations"
                              stroke="#82ca9d"
                              fill="#82ca9d"
                            />
                          </AreaChart>
                        </ResponsiveContainer>
                      ) : (
                        <div className="flex flex-col h-full justify-center items-center text-gray-500 dark:text-slate-400">
                          <LineChart className="h-16 w-16 mb-4 opacity-20" />
                          <p className="text-lg font-medium">
                            No trend data available
                          </p>
                          <p className="text-sm mt-2">
                            Please select a date range to view trend data
                          </p>
                        </div>
                      )}
                    </CardContent>
                  </Card>

                  <Card className="bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700 shadow-sm hover:shadow-lg transition-shadow">
                    <CardHeader>
                      <CardTitle className="text-lg font-medium text-gray-900 dark:text-white flex items-center gap-2">
                        <LineChart className="h-5 w-5 text-primary" />
                        Daily Premium Trend
                      </CardTitle>
                      <CardDescription>
                        Premium volume over time for the selected period
                      </CardDescription>
                    </CardHeader>
                    <CardContent className="p-2 h-[400px]">
                      {timeSeriesData && timeSeriesData.length > 0 ? (
                        <ResponsiveContainer width="100%" height="100%">
                          <ReLineChart
                            data={timeSeriesData}
                            margin={{ top: 20, right: 30, left: 20, bottom: 5 }}
                          >
                            <CartesianGrid strokeDasharray="3 3" />
                            <XAxis
                              dataKey="date"
                              tickFormatter={(date) =>
                                format(new Date(date), "dd MMM")
                              }
                            />
                            <YAxis />
                            <Tooltip
                              labelFormatter={(label) =>
                                format(new Date(label), "dd MMM yyyy")
                              }
                              formatter={(value: any) => [
                                `${safeNumberFormat(value, "AED")}`,
                                "Premium",
                              ]}
                            />
                            <Legend />
                            <Line
                              type="monotone"
                              dataKey="premium"
                              name="Daily Premium (AED)"
                              stroke="#FF8042"
                              strokeWidth={2}
                            />
                          </ReLineChart>
                        </ResponsiveContainer>
                      ) : (
                        <div className="flex flex-col h-full justify-center items-center text-gray-500 dark:text-slate-400">
                          <LineChart className="h-16 w-16 mb-4 opacity-20" />
                          <p className="text-lg font-medium">
                            No premium trend data available
                          </p>
                          <p className="text-sm mt-2">
                            Please select a date range to view premium trends
                          </p>
                        </div>
                      )}
                    </CardContent>
                  </Card>

                  <Card className="bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700 shadow-sm hover:shadow-lg transition-shadow">
                    <CardHeader>
                      <CardTitle className="text-lg font-medium text-gray-900 dark:text-white flex items-center gap-2">
                        <TrendingUp className="h-5 w-5 text-primary" />
                        Quotation to Conversion Efficiency
                      </CardTitle>
                      <CardDescription>
                        Daily conversion rates over time
                      </CardDescription>
                    </CardHeader>
                    <CardContent className="p-2 h-[400px]">
                      {timeSeriesData && timeSeriesData.length > 0 ? (
                        <ResponsiveContainer width="100%" height="100%">
                          <ReLineChart
                            data={timeSeriesData.map(
                              (item: TimeSeriesData) => ({
                                ...item,
                                conversionRate:
                                  item.newQuotations > 0
                                    ? (item.confirmedQuotations /
                                        item.newQuotations) *
                                      100
                                    : 0,
                              })
                            )}
                            margin={{ top: 20, right: 30, left: 20, bottom: 5 }}
                          >
                            <CartesianGrid strokeDasharray="3 3" />
                            <XAxis
                              dataKey="date"
                              tickFormatter={(date) =>
                                format(new Date(date), "dd MMM")
                              }
                            />
                            <YAxis yAxisId="left" />
                            <YAxis
                              yAxisId="right"
                              orientation="right"
                              domain={[0, 100]}
                            />
                            <Tooltip
                              labelFormatter={(label) =>
                                format(new Date(label), "dd MMM yyyy")
                              }
                              formatter={(value: any, name: string) => {
                                if (name === "Conversion Rate (%)") {
                                  return [`${value.toFixed(2)}%`, name];
                                }
                                return [value, name];
                              }}
                            />
                            <Legend />
                            <Bar
                              dataKey="newQuotations"
                              name="New Quotations"
                              yAxisId="left"
                              fill="#8884d8"
                            />
                            <Line
                              type="monotone"
                              dataKey="conversionRate"
                              name="Conversion Rate (%)"
                              yAxisId="right"
                              stroke="#ff7300"
                              strokeWidth={2}
                            />
                          </ReLineChart>
                        </ResponsiveContainer>
                      ) : (
                        <div className="flex flex-col h-full justify-center items-center text-gray-500 dark:text-slate-400">
                          <TrendingUp className="h-16 w-16 mb-4 opacity-20" />
                          <p className="text-lg font-medium">
                            No conversion efficiency data available
                          </p>
                          <p className="text-sm mt-2">
                            Please select a date range to view conversion trends
                          </p>
                        </div>
                      )}
                    </CardContent>
                  </Card>
                </TabsContent>
              </Tabs>
            </>
          )}
        </div>
      </main>
      <ScrollToTop />
    </div>
  );
}
