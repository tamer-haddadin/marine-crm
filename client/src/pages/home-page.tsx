import { useAuth } from "@/hooks/use-auth";
import { Button } from "@/components/ui/button";
import { Link } from "wouter";
import OrderList from "@/components/orders/order-list";
import OrderForm from "@/components/orders/order-form";
import PropertyEngineeringOrderForm from "@/components/orders/property-engineering-order-form";
import PropertyEngineeringOrderList from "@/components/orders/property-engineering-order-list";
import PropertyEngineeringQuotationForm from "@/components/quotations/property-engineering-quotation-form";
import PropertyEngineeringQuotationList from "@/components/quotations/property-engineering-quotation-list";
import LiabilityQuotationForm from "@/components/quotations/liability-quotation-form";
import LiabilityQuotationList from "@/components/quotations/liability-quotation-list";
import LiabilityOrderForm from "@/components/orders/liability-order-form";
import LiabilityOrderList from "@/components/orders/liability-order-list";
import { useState, useMemo } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Ship,
  Building2,
  LogOut,
  FileText,
  ClipboardList,
  BarChart3,
  TrendingUp,
  FileCheck,
  Brain,
  FileCheck as FileCheck2,
  DollarSign,
  BarChart4,
  ArrowUpRight,
  Settings,
  User,
  Shield,
  Anchor,
  Sparkles,
  ChevronRight,
  Target,
  Package,
  Waves,
  ExternalLink,
  Calendar,
  ChevronDown,
  CircleDot,
} from "lucide-react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import QuotationList from "@/components/quotations/quotation-list";
import QuotationForm from "@/components/quotations/quotation-form";
import { useQuery } from "@tanstack/react-query";
import {
  Order,
  Quotation,
  PropertyEngineeringOrder,
  PropertyEngineeringQuotation,
  LiabilityOrder,
  LiabilityQuotation,
} from "@shared/schema";
import { ScrollToTop } from "@/components/ui/scroll-to-top";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

export default function HomePage() {
  const { user, logoutMutation } = useAuth();
  const [showNewOrder, setShowNewOrder] = useState(false);
  const [showNewQuotation, setShowNewQuotation] = useState(false);
  const [showNewPropertyOrder, setShowNewPropertyOrder] = useState(false);
  const [showNewPropertyQuotation, setShowNewPropertyQuotation] =
    useState(false);
  const [showNewLiabilityOrder, setShowNewLiabilityOrder] = useState(false);
  const [showNewLiabilityQuotation, setShowNewLiabilityQuotation] =
    useState(false);
  const [selectedYear, setSelectedYear] = useState<number>(2026);

  // Available years for selection
  const availableYears = [2024, 2025, 2026, 2027];

  // Query all orders including closed ones for total count - only for Marine users
  const { data: allOrders } = useQuery<Order[]>({
    queryKey: ["/api/orders", "all"],
    queryFn: async () => {
      const response = await fetch("/api/orders?includeAll=true", {
        credentials: "include",
      });
      if (!response.ok) throw new Error("Failed to fetch orders");
      return response.json();
    },
    enabled: user?.department === "Marine",
    refetchInterval: 5000,
  });

  const { data: quotations } = useQuery<Quotation[]>({
    queryKey: ["/api/quotations"],
    enabled: user?.department === "Marine",
    refetchInterval: 5000,
  });

  const { data: propertyOrders } = useQuery<PropertyEngineeringOrder[]>({
    queryKey: ["/api/property-engineering/orders", "all"],
    queryFn: async () => {
      const response = await fetch(
        "/api/property-engineering/orders?includeAll=true",
        { credentials: "include" }
      );
      if (!response.ok) throw new Error("Failed to fetch orders");
      return response.json();
    },
    enabled: user?.department === "Property & Engineering",
    refetchInterval: 5000,
  });

  const { data: propertyQuotations } = useQuery<PropertyEngineeringQuotation[]>(
    {
      queryKey: ["/api/property-engineering/quotations"],
      enabled: user?.department === "Property & Engineering",
      refetchInterval: 5000,
    }
  );

  const { data: liabilityOrders } = useQuery<LiabilityOrder[]>({
    queryKey: ["/api/liability/orders", "all"],
    queryFn: async () => {
      const response = await fetch("/api/liability/orders?includeAll=true", {
        credentials: "include",
      });
      if (!response.ok) throw new Error("Failed to fetch orders");
      return response.json();
    },
    enabled: user?.department === "Liability & Financial",
    refetchInterval: 5000,
  });

  const { data: liabilityQuotations } = useQuery<LiabilityQuotation[]>({
    queryKey: ["/api/liability/quotations"],
    enabled: user?.department === "Liability & Financial",
    refetchInterval: 5000,
  });

  const calculateMetrics = () => {
    const orders =
      user?.department === "Marine"
        ? allOrders
        : user?.department === "Property & Engineering"
        ? propertyOrders
        : user?.department === "Liability & Financial"
        ? liabilityOrders
        : [];
    const quots =
      user?.department === "Marine"
        ? quotations
        : user?.department === "Property & Engineering"
        ? propertyQuotations
        : user?.department === "Liability & Financial"
        ? liabilityQuotations
        : [];

    if (user?.department === "Marine") {
      const filteredOrders = orders || [];
      const totalPremium = filteredOrders.reduce((sum, order) => {
        const premium = parseFloat(order.premium || "0");
        return sum + (isNaN(premium) ? 0 : premium);
      }, 0);

      const newBusinessPremium = filteredOrders
        .filter((order) => order.businessType === "New Business")
        .reduce((sum, order) => {
          const premium = parseFloat(order.premium || "0");
          return sum + (isNaN(premium) ? 0 : premium);
        }, 0);

      const renewalPremium = filteredOrders
        .filter((order) => order.businessType === "Renewal")
        .reduce((sum, order) => {
          const premium = parseFloat(order.premium || "0");
          return sum + (isNaN(premium) ? 0 : premium);
        }, 0);

      const openQuotations = quots?.filter((q) => q.status === "Open").length || 0;
      const confirmedQuotations = quots?.filter((q) => q.status === "Confirmed").length || 0;
      const declinedQuotations = quots?.filter((q) => q.status === "Decline").length || 0;
      const activeQuotations = (quots?.length || 0) - declinedQuotations;

      return {
        totalOrders: filteredOrders.length,
        totalQuotations: quots?.length || 0,
        totalPremium,
        newBusinessPremium,
        renewalPremium,
        openQuotations,
        confirmedQuotations,
        declinedQuotations,
        activeQuotations,
      };
    } else if (user?.department === "Property & Engineering") {
      const filteredOrders = orders || [];
      const totalPremium = filteredOrders.reduce((sum, order) => {
        const premium = parseFloat(order.premium || "0");
        return sum + (isNaN(premium) ? 0 : premium);
      }, 0);

      const newBusinessPremium = filteredOrders
        .filter((order) => order.businessType === "New Business")
        .reduce((sum, order) => {
          const premium = parseFloat(order.premium || "0");
          return sum + (isNaN(premium) ? 0 : premium);
        }, 0);

      const renewalPremium = filteredOrders
        .filter((order) => order.businessType === "Renewal")
        .reduce((sum, order) => {
          const premium = parseFloat(order.premium || "0");
          return sum + (isNaN(premium) ? 0 : premium);
        }, 0);

      const openQuotations = quots?.filter((q) => q.status === "Open").length || 0;
      const confirmedQuotations = quots?.filter((q) => q.status === "Confirmed").length || 0;
      const declinedQuotations = quots?.filter((q) => q.status === "Decline").length || 0;
      const activeQuotations = (quots?.length || 0) - declinedQuotations;

      return {
        totalOrders: filteredOrders.length,
        totalQuotations: quots?.length || 0,
        totalPremium,
        newBusinessPremium,
        renewalPremium,
        openQuotations,
        confirmedQuotations,
        declinedQuotations,
        activeQuotations,
      };
    } else if (user?.department === "Liability & Financial") {
      const filteredOrders = orders || [];
      const totalPremium = filteredOrders.reduce((sum, order) => {
        const premium = parseFloat(order.premium || "0");
        return sum + (isNaN(premium) ? 0 : premium);
      }, 0);

      const newBusinessPremium = filteredOrders
        .filter((order) => order.businessType === "New Business")
        .reduce((sum, order) => {
          const premium = parseFloat(order.premium || "0");
          return sum + (isNaN(premium) ? 0 : premium);
        }, 0);

      const renewalPremium = filteredOrders
        .filter((order) => order.businessType === "Renewal")
        .reduce((sum, order) => {
          const premium = parseFloat(order.premium || "0");
          return sum + (isNaN(premium) ? 0 : premium);
        }, 0);

      const openQuotations = quots?.filter((q) => q.status === "Open").length || 0;
      const confirmedQuotations = quots?.filter((q) => q.status === "Confirmed").length || 0;
      const declinedQuotations = quots?.filter((q) => q.status === "Decline").length || 0;
      const activeQuotations = (quots?.length || 0) - declinedQuotations;

      return {
        totalOrders: filteredOrders.length,
        totalQuotations: quots?.length || 0,
        totalPremium,
        newBusinessPremium,
        renewalPremium,
        openQuotations,
        confirmedQuotations,
        declinedQuotations,
        activeQuotations,
      };
    } else {
      return {
        totalOrders: 0,
        totalQuotations: 0,
        totalPremium: 0,
        newBusinessPremium: 0,
        renewalPremium: 0,
        openQuotations: 0,
        confirmedQuotations: 0,
        declinedQuotations: 0,
        activeQuotations: 0,
      };
    }
  };

  const metrics = calculateMetrics();

  // Annual Targets for Marine by year
  const MARINE_TARGETS: Record<number, {
    marineCargo: { yearly: number; monthly: number[] };
    marineHull: { yearly: number; monthly: number[] };
  }> = {
    2024: {
      marineCargo: { yearly: 20000000, monthly: [4500000, 3200000, 1800000, 1400000, 1900000, 1400000, 1100000, 1000000, 1050000, 1100000, 1550000, 1000000] },
      marineHull: { yearly: 9000000, monthly: [900000, 1500000, 500000, 580000, 1220000, 870000, 380000, 510000, 580000, 460000, 530000, 970000] }
    },
    2025: {
      marineCargo: { yearly: 22000000, monthly: [4900000, 3500000, 1900000, 1480000, 2000000, 1480000, 1160000, 1050000, 1100000, 1180000, 1650000, 1600000] },
      marineHull: { yearly: 10000000, monthly: [1000000, 1650000, 560000, 640000, 1350000, 960000, 420000, 570000, 650000, 510000, 590000, 1100000] }
    },
    2026: {
      marineCargo: { yearly: 25000000, monthly: [5362614, 3853507, 2059239, 1599800, 2159781, 1600365, 1259177, 1140162, 1200659, 1280724, 1782742, 1701230] },
      marineHull: { yearly: 11000000, monthly: [1101052, 1816793, 615138, 710362, 1496726, 1062651, 469876, 629817, 715112, 565889, 654404, 1162179] }
    },
    2027: {
      marineCargo: { yearly: 27500000, monthly: [5900000, 4240000, 2265000, 1760000, 2376000, 1760000, 1385000, 1254000, 1321000, 1409000, 1961000, 1870000] },
      marineHull: { yearly: 12100000, monthly: [1211000, 1998000, 677000, 781000, 1646000, 1169000, 517000, 693000, 787000, 622000, 720000, 1279000] }
    }
  };

  // Get targets for selected year (fallback to 2026 if not defined)
  const getTargetsForYear = (year: number) => {
    return MARINE_TARGETS[year] || MARINE_TARGETS[2026];
  };

  // Categorize Marine products
  const MARINE_CARGO_PRODUCTS = [
    "Marine Cargo Single Shipment",
    "Marine Open Cover",
    "Goods in Transit",
    "Haulier Liability/FFL",
    "Aviation"
  ];

  const MARINE_HULL_PRODUCTS = [
    "Commercial Vessel",
    "Pleasure Boats",
    "Jetski",
    "P&I",
    "Marine Liability"
  ];

  // Closing Rules: Monthly closing is 25th
  // Orders 1st-25th → Current month production
  // Orders 26th-31st → Next month production
  const getProductionMonth = (orderDate: Date | string): { month: number; year: number } => {
    const date = new Date(orderDate);
    const day = date.getDate();
    let month = date.getMonth(); // 0-indexed (0 = January)
    let year = date.getFullYear();

    // If order is after 25th, it counts for next month
    if (day > 25) {
      month += 1;
      // Handle year rollover (December 26-31 → January next year)
      if (month > 11) {
        month = 0;
        year += 1;
      }
    }

    return { month, year };
  };

  // Calculate KPIs for Marine department - memoized with explicit dependencies
  // Note: Actuals include ALL orders since previous years are "closed"
  // The year selector only changes the TARGETS for comparison
  const kpis = useMemo(() => {
    if (user?.department !== "Marine" || !allOrders) {
      return null;
    }

    // Use ALL orders for actuals (previous years are closed, all counts toward current)
    const cargoOrders = allOrders.filter(order =>
      MARINE_CARGO_PRODUCTS.includes(order.marineProductType)
    );
    const hullOrders = allOrders.filter(order =>
      MARINE_HULL_PRODUCTS.includes(order.marineProductType)
    );

    const cargoActual = cargoOrders.reduce((sum, order) => {
      const premium = parseFloat(order.premium || "0");
      return sum + (isNaN(premium) ? 0 : premium);
    }, 0);

    const hullActual = hullOrders.reduce((sum, order) => {
      const premium = parseFloat(order.premium || "0");
      return sum + (isNaN(premium) ? 0 : premium);
    }, 0);

    // Get targets for the selected year
    const yearTargets = getTargetsForYear(selectedYear);

    const totalActual = cargoActual + hullActual;
    const totalTarget = yearTargets.marineCargo.yearly + yearTargets.marineHull.yearly;

    return {
      cargo: {
        actual: cargoActual,
        target: yearTargets.marineCargo.yearly,
        variance: cargoActual - yearTargets.marineCargo.yearly,
        progress: (cargoActual / yearTargets.marineCargo.yearly) * 100
      },
      hull: {
        actual: hullActual,
        target: yearTargets.marineHull.yearly,
        variance: hullActual - yearTargets.marineHull.yearly,
        progress: (hullActual / yearTargets.marineHull.yearly) * 100
      },
      total: {
        actual: totalActual,
        target: totalTarget,
        variance: totalActual - totalTarget,
        progress: (totalActual / totalTarget) * 100
      }
    };
  }, [user?.department, allOrders, selectedYear]);

  // Format number to millions
  const formatToMillions = (num: number) => {
    if (Math.abs(num) >= 1000000) {
      return (num / 1000000).toFixed(2) + 'M';
    }
    return num.toLocaleString();
  };

  return (
    <div className="dashboard-bg">
      {/* Premium Header */}
      <header className="header-premium">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex justify-between items-center">
            {/* Logo & Brand */}
            <div className="flex items-center gap-4">
              <img
                src="/platform-logo.png"
                alt="Insurance Platform"
                className="h-20 w-auto object-contain drop-shadow-lg"
              />
              <div className="flex flex-col">
                <h1 className="font-display text-xl font-semibold tracking-tight text-foreground">
                  {user?.department || "Marine"} <span className="text-gold">Underwriting</span>
                </h1>
                <span className="text-xs text-muted-foreground font-medium tracking-wide uppercase">
                  Premium Insurance Platform
                </span>
              </div>
            </div>

            {/* Navigation & Actions */}
            <div className="flex items-center gap-3">
              <Link href="/closed-policies">
                <Button
                  variant="ghost"
                  className="gap-2.5 text-muted-foreground hover:text-foreground hover:bg-muted/50 transition-all duration-300 px-4 py-2.5 h-auto"
                >
                  <FileCheck2 className="h-5 w-5 text-emerald" />
                  <span className="hidden md:inline font-medium text-[15px]">Closed Policies</span>
                </Button>
              </Link>
              <Link href="/ai-report">
                <Button
                  variant="ghost"
                  className="gap-2.5 text-muted-foreground hover:text-foreground hover:bg-muted/50 transition-all duration-300 px-4 py-2.5 h-auto"
                >
                  <Brain className="h-5 w-5 text-purple-500" />
                  <span className="hidden md:inline font-medium text-[15px]">AI Report</span>
                </Button>
              </Link>
              <Link href="/management-report">
                <Button
                  variant="ghost"
                  className="gap-2.5 text-muted-foreground hover:text-foreground hover:bg-muted/50 transition-all duration-300 px-4 py-2.5 h-auto"
                >
                  <BarChart4 className="h-5 w-5 text-navy-light" />
                  <span className="hidden md:inline font-medium text-[15px]">Reports</span>
                </Button>
              </Link>

              {/* Year Selector - Only for Marine department */}
              {user?.department === "Marine" && (
                <>
                  <div className="w-px h-8 bg-border mx-2" />
                  <Link href="/kpi-performance">
                    <div className="btn-gradient-glow btn-gradient-glow-sm cursor-pointer">
                      <span className="btn-gradient-glow-inner whitespace-nowrap">
                        <Target className="h-4 w-4" />
                        <span className="hidden md:inline">KPI Performance</span>
                      </span>
                    </div>
                  </Link>
                  <Select
                    value={selectedYear.toString()}
                    onValueChange={(value) => setSelectedYear(parseInt(value))}
                  >
                    <SelectTrigger className="w-[120px] h-11 bg-gradient-navy text-gold border-gold/20 hover:border-gold/40 shadow-premium-sm text-[15px] font-medium">
                      <Calendar className="h-5 w-5 mr-2" />
                      <SelectValue placeholder="Year" />
                    </SelectTrigger>
                    <SelectContent className="bg-card border-border shadow-premium-lg">
                      {availableYears.map((year) => (
                        <SelectItem
                          key={year}
                          value={year.toString()}
                          className="cursor-pointer hover:bg-muted/50 text-[15px]"
                        >
                          {year}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </>
              )}

              <div className="w-px h-6 bg-border mx-2" />

              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="gap-2 hover:bg-muted/50 transition-all duration-300"
                  >
                    <div className="flex items-center">
                      <div className="h-9 w-9 rounded-xl bg-gradient-navy flex items-center justify-center text-gold font-display font-semibold text-sm shadow-premium-sm">
                        {user?.username.charAt(0).toUpperCase()}
                      </div>
                      <div className="ml-3 hidden md:block text-left">
                        <span className="block text-sm font-medium text-foreground">
                          {user?.username}
                        </span>
                        <span className="block text-xs text-muted-foreground">
                          {user?.department}
                        </span>
                      </div>
                    </div>
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent
                  align="end"
                  className="w-56 p-2 bg-card border-border shadow-premium-lg"
                >
                  <div className="flex items-center justify-start p-3 bg-muted/50 rounded-lg mb-2">
                    <div className="h-10 w-10 rounded-xl bg-gradient-navy flex items-center justify-center text-gold font-display font-semibold shadow-premium-sm">
                      {user?.username.charAt(0).toUpperCase()}
                    </div>
                    <div className="ml-3">
                      <p className="text-sm font-semibold text-foreground">
                        {user?.username}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {user?.department} Department
                      </p>
                    </div>
                  </div>
                  <DropdownMenuSeparator className="bg-border/50" />
                  <Link href="/profile">
                    <DropdownMenuItem className="p-3 rounded-lg cursor-pointer hover:bg-muted/50 transition-colors">
                      <User className="mr-3 h-4 w-4 text-muted-foreground" />
                      <span className="font-medium">Profile</span>
                    </DropdownMenuItem>
                  </Link>
                  <Link href="/settings">
                    <DropdownMenuItem className="p-3 rounded-lg cursor-pointer hover:bg-muted/50 transition-colors">
                      <Settings className="mr-3 h-4 w-4 text-muted-foreground" />
                      <span className="font-medium">Settings</span>
                    </DropdownMenuItem>
                  </Link>
                  <DropdownMenuSeparator className="bg-border/50" />
                  <DropdownMenuItem
                    onClick={() => logoutMutation.mutate()}
                    className="p-3 rounded-lg cursor-pointer hover:bg-destructive/10 text-destructive transition-colors"
                  >
                    <LogOut className="mr-3 h-4 w-4" />
                    <span className="font-medium">Sign out</span>
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10">
        {/* Welcome Section */}
        <div className="mb-10 animate-fade-in">
          <div className="flex items-end justify-between">
            <div>
              <p className="text-sm font-medium text-gold tracking-wide uppercase mb-2">
                Welcome back
              </p>
              <h2 className="font-display text-4xl font-semibold text-foreground tracking-tight">
                Dashboard <span className="text-muted-foreground font-sans text-2xl font-normal">Overview</span>
              </h2>
            </div>
            <div className="hidden lg:flex items-center gap-2 text-sm text-muted-foreground">
              <Sparkles className="h-4 w-4 text-gold" />
              <span>Real-time data updates</span>
            </div>
          </div>
        </div>

        {/* Premium Metric Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 mb-12">
          {/* Orders Card */}
          <div className="card-premium p-6 animate-fade-in-up stagger-1">
            <div className="flex items-start justify-between mb-4">
              <div className="metric-icon-wrapper bg-navy/10">
                <ClipboardList className="h-5 w-5 text-navy dark:text-navy-light" />
              </div>
              <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                {user?.department === "Marine"
                  ? "Marine"
                  : user?.department === "Property & Engineering"
                  ? "P&E"
                  : "Liability"}{" "}
                Orders
              </span>
            </div>
            <div className="metric-value text-foreground">{metrics.totalOrders}</div>
            <p className="text-sm text-muted-foreground mt-2">
              Total firm orders in system
            </p>
          </div>

          {/* Quotations Card */}
          <div className="card-premium p-6 animate-fade-in-up stagger-2">
            <div className="flex items-start justify-between mb-4">
              <div className="metric-icon-wrapper bg-purple-500/10">
                <FileText className="h-5 w-5 text-purple-600 dark:text-purple-400" />
              </div>
              <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                Quotations
              </span>
            </div>
            <div className="metric-value text-foreground">{metrics.totalQuotations}</div>
            <div className="flex gap-3 mt-3">
              <span className="badge-warning">
                Open: {metrics.openQuotations}
              </span>
              <span className="badge-success">
                Confirmed: {metrics.confirmedQuotations}
              </span>
            </div>
          </div>

          {/* Conversion Rate Card */}
          <div className="card-premium p-6 animate-fade-in-up stagger-3">
            <div className="flex items-start justify-between mb-4">
              <div className="metric-icon-wrapper bg-emerald/10">
                <TrendingUp className="h-5 w-5 text-emerald" />
              </div>
              <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                Conversion
              </span>
            </div>
            <div className="flex items-baseline gap-1">
              <span className="metric-value text-emerald">
                {metrics.activeQuotations
                  ? Math.round(
                      (metrics.confirmedQuotations / metrics.activeQuotations) * 100
                    )
                  : 0}
              </span>
              <span className="text-xl font-semibold text-emerald/70">%</span>
            </div>
            <p className="text-sm text-muted-foreground mt-2">
              Confirmed / Active quotations
            </p>
          </div>

          {/* Premium Card - Gold Accent */}
          <div className="card-gold-accent p-6 animate-fade-in-up stagger-4">
            <div className="flex items-start justify-between mb-4">
              <div className="metric-icon-wrapper bg-gold/10">
                <DollarSign className="h-5 w-5 text-gold" />
              </div>
              <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                Total Premium
              </span>
            </div>
            <div className="flex items-baseline gap-2">
              <span className="text-sm font-medium text-gold">AED</span>
              <span className="metric-value text-foreground">
                {metrics.totalPremium.toLocaleString(undefined, {
                  minimumFractionDigits: 0,
                  maximumFractionDigits: 0,
                })}
              </span>
            </div>
            <div className="flex justify-between mt-3 text-xs">
              <span className="text-muted-foreground">
                New: <span className="font-mono font-medium text-foreground">
                  {metrics.newBusinessPremium.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
                </span>
              </span>
              <span className="text-muted-foreground">
                Renewal: <span className="font-mono font-medium text-foreground">
                  {metrics.renewalPremium.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
                </span>
              </span>
            </div>
          </div>
        </div>

        {/* Production KPI Summary - Only for Marine department */}
        {user?.department === "Marine" && kpis && (
          <div id="kpi-section" className="mb-12 animate-fade-in scroll-mt-24">
            {/* Section Header */}
            <div className="flex items-center justify-between mb-6">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-gold/10">
                  <Target className="h-5 w-5 text-gold" />
                </div>
                <h2 className="font-display text-2xl font-semibold text-foreground tracking-tight">
                  Production KPI Summary
                </h2>
              </div>
              <div className="flex items-center gap-3">
                <span className="px-3 py-1.5 rounded-lg bg-amber-500/10 text-amber-600 font-semibold text-sm border border-amber-500/20 flex items-center gap-2">
                  <CircleDot className="h-3.5 w-3.5" />
                  Closing: 25th
                </span>
                <span className="px-4 py-2 rounded-lg bg-emerald/10 text-emerald font-semibold text-sm border border-emerald/20">
                  Target Year: {selectedYear}
                </span>
                <Link href="/management-report">
                  <Button variant="outline" size="sm" className="gap-2 font-medium">
                    <BarChart4 className="h-4 w-4" />
                    View Details
                    <ExternalLink className="h-3 w-3" />
                  </Button>
                </Link>
              </div>
            </div>

            {/* KPI Cards Grid */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {/* Marine Cargo KPI Card */}
              <div className="card-premium p-6">
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center gap-3">
                    <div className="p-2 rounded-lg bg-cyan-500/10">
                      <Package className="h-5 w-5 text-cyan-600" />
                    </div>
                    <span className="font-semibold text-cyan-600">Marine Cargo</span>
                  </div>
                  <TrendingUp className="h-5 w-5 text-muted-foreground/50" />
                </div>
                <p className="text-sm text-muted-foreground mb-4">
                  Target: <span className="font-semibold text-foreground">AED {formatToMillions(kpis.cargo.target)}</span>
                </p>

                {/* Progress Section */}
                <div className="space-y-2 mb-4">
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-muted-foreground">Annual Progress</span>
                    <span className={`font-semibold ${kpis.cargo.progress >= 100 ? 'text-emerald' : 'text-amber-600'}`}>
                      {kpis.cargo.progress.toFixed(1)}%
                    </span>
                  </div>
                  <div className="h-2 bg-muted rounded-full overflow-hidden">
                    <div
                      className={`h-full rounded-full transition-all duration-500 ${
                        kpis.cargo.progress >= 100 ? 'bg-emerald' : kpis.cargo.progress >= 50 ? 'bg-amber-500' : 'bg-red-500'
                      }`}
                      style={{ width: `${Math.min(kpis.cargo.progress, 100)}%` }}
                    />
                  </div>
                </div>

                {/* Actual & Variance */}
                <div className="flex items-center justify-between pt-4 border-t border-border">
                  <div>
                    <p className="text-xs text-muted-foreground mb-1">Actual</p>
                    <p className="font-mono font-semibold text-lg text-foreground">
                      AED {formatToMillions(kpis.cargo.actual)}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="text-xs text-muted-foreground mb-1">Variance</p>
                    <p className={`font-mono font-semibold text-lg ${kpis.cargo.variance >= 0 ? 'text-emerald' : 'text-red-500'}`}>
                      AED {kpis.cargo.variance >= 0 ? '' : ''}{formatToMillions(kpis.cargo.variance)}
                    </p>
                  </div>
                </div>
              </div>

              {/* Marine Hull KPI Card */}
              <div className="card-premium p-6">
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center gap-3">
                    <div className="p-2 rounded-lg bg-blue-500/10">
                      <Anchor className="h-5 w-5 text-blue-600" />
                    </div>
                    <span className="font-semibold text-blue-600">Marine Hull</span>
                  </div>
                  <TrendingUp className="h-5 w-5 text-muted-foreground/50" />
                </div>
                <p className="text-sm text-muted-foreground mb-4">
                  Target: <span className="font-semibold text-foreground">AED {formatToMillions(kpis.hull.target)}</span>
                </p>

                {/* Progress Section */}
                <div className="space-y-2 mb-4">
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-muted-foreground">Annual Progress</span>
                    <span className={`font-semibold ${kpis.hull.progress >= 100 ? 'text-emerald' : 'text-amber-600'}`}>
                      {kpis.hull.progress.toFixed(1)}%
                    </span>
                  </div>
                  <div className="h-2 bg-muted rounded-full overflow-hidden">
                    <div
                      className={`h-full rounded-full transition-all duration-500 ${
                        kpis.hull.progress >= 100 ? 'bg-emerald' : kpis.hull.progress >= 50 ? 'bg-amber-500' : 'bg-red-500'
                      }`}
                      style={{ width: `${Math.min(kpis.hull.progress, 100)}%` }}
                    />
                  </div>
                </div>

                {/* Actual & Variance */}
                <div className="flex items-center justify-between pt-4 border-t border-border">
                  <div>
                    <p className="text-xs text-muted-foreground mb-1">Actual</p>
                    <p className="font-mono font-semibold text-lg text-foreground">
                      AED {formatToMillions(kpis.hull.actual)}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="text-xs text-muted-foreground mb-1">Variance</p>
                    <p className={`font-mono font-semibold text-lg ${kpis.hull.variance >= 0 ? 'text-emerald' : 'text-red-500'}`}>
                      AED {kpis.hull.variance >= 0 ? '' : ''}{formatToMillions(kpis.hull.variance)}
                    </p>
                  </div>
                </div>
              </div>

              {/* Total Marine KPI Card */}
              <div className="card-gold-accent p-6">
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center gap-3">
                    <div className="p-2 rounded-lg bg-purple-500/10">
                      <BarChart4 className="h-5 w-5 text-purple-600" />
                    </div>
                    <span className="font-semibold text-purple-600">Total Marine</span>
                  </div>
                  <TrendingUp className="h-5 w-5 text-muted-foreground/50" />
                </div>
                <p className="text-sm text-muted-foreground mb-4">
                  Target: <span className="font-semibold text-foreground">AED {formatToMillions(kpis.total.target)}</span>
                </p>

                {/* Progress Section */}
                <div className="space-y-2 mb-4">
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-muted-foreground">Annual Progress</span>
                    <span className={`font-semibold ${kpis.total.progress >= 100 ? 'text-emerald' : 'text-amber-600'}`}>
                      {kpis.total.progress.toFixed(1)}%
                    </span>
                  </div>
                  <div className="h-2 bg-muted rounded-full overflow-hidden">
                    <div
                      className={`h-full rounded-full transition-all duration-500 ${
                        kpis.total.progress >= 100 ? 'bg-emerald' : kpis.total.progress >= 50 ? 'bg-amber-500' : 'bg-red-500'
                      }`}
                      style={{ width: `${Math.min(kpis.total.progress, 100)}%` }}
                    />
                  </div>
                </div>

                {/* Actual & Variance */}
                <div className="flex items-center justify-between pt-4 border-t border-border">
                  <div>
                    <p className="text-xs text-muted-foreground mb-1">Actual</p>
                    <p className="font-mono font-semibold text-lg text-foreground">
                      AED {formatToMillions(kpis.total.actual)}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="text-xs text-muted-foreground mb-1">Variance</p>
                    <p className={`font-mono font-semibold text-lg ${kpis.total.variance >= 0 ? 'text-emerald' : 'text-red-500'}`}>
                      AED {kpis.total.variance >= 0 ? '' : ''}{formatToMillions(kpis.total.variance)}
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Business Activity Section */}
        <div className="mb-8 animate-fade-in stagger-5">
          <div className="flex items-center justify-between mb-6">
            <div>
              <h2 className="font-display text-2xl font-semibold text-foreground tracking-tight">
                Business Activity
              </h2>
              <p className="text-sm text-muted-foreground mt-1">
                Manage your orders and quotations
              </p>
            </div>
            <Link href="/management-report">
              <Button className="btn-outline-premium gap-2 text-sm">
                <BarChart4 className="h-4 w-4" />
                <span>Detailed Reports</span>
                <ChevronRight className="h-4 w-4" />
              </Button>
            </Link>
          </div>
        </div>

        {/* Premium Tabs Section */}
        <Tabs
          defaultValue={
            user?.department === "Marine"
              ? "orders"
              : user?.department === "Property & Engineering"
              ? "property-orders"
              : "liability-orders"
          }
          className="space-y-8 animate-fade-in stagger-6"
        >
          <div className="flex flex-col sm:flex-row justify-between items-start gap-4">
            <TabsList className="bg-card p-1.5 rounded-xl border border-border shadow-premium-sm">
              {user?.department === "Marine" && (
                <>
                  <TabsTrigger
                    value="orders"
                    className="rounded-lg gap-2 px-4 py-2.5 data-[state=active]:bg-gradient-navy data-[state=active]:text-gold data-[state=active]:shadow-premium-sm transition-all duration-300"
                  >
                    <ClipboardList className="h-4 w-4" />
                    <span className="font-medium">Marine Orders</span>
                  </TabsTrigger>
                  <TabsTrigger
                    value="quotations"
                    className="rounded-lg gap-2 px-4 py-2.5 data-[state=active]:bg-purple-600 data-[state=active]:text-white data-[state=active]:shadow-premium-sm transition-all duration-300"
                  >
                    <FileText className="h-4 w-4" />
                    <span className="font-medium">Quotations</span>
                  </TabsTrigger>
                </>
              )}
              {user?.department === "Property & Engineering" && (
                <>
                  <TabsTrigger
                    value="property-orders"
                    className="rounded-lg gap-2 px-4 py-2.5 data-[state=active]:bg-emerald data-[state=active]:text-white data-[state=active]:shadow-premium-sm transition-all duration-300"
                  >
                    <ClipboardList className="h-4 w-4" />
                    <span className="font-medium">P&E Orders</span>
                  </TabsTrigger>
                  <TabsTrigger
                    value="property-quotations"
                    className="rounded-lg gap-2 px-4 py-2.5 data-[state=active]:bg-orange-500 data-[state=active]:text-white data-[state=active]:shadow-premium-sm transition-all duration-300"
                  >
                    <FileText className="h-4 w-4" />
                    <span className="font-medium">Quotations</span>
                  </TabsTrigger>
                </>
              )}
              {user?.department === "Liability & Financial" && (
                <>
                  <TabsTrigger
                    value="liability-orders"
                    className="rounded-lg gap-2 px-4 py-2.5 data-[state=active]:bg-indigo-600 data-[state=active]:text-white data-[state=active]:shadow-premium-sm transition-all duration-300"
                  >
                    <Shield className="h-4 w-4" />
                    <span className="font-medium">Liability Orders</span>
                  </TabsTrigger>
                  <TabsTrigger
                    value="liability-quotations"
                    className="rounded-lg gap-2 px-4 py-2.5 data-[state=active]:bg-indigo-600 data-[state=active]:text-white data-[state=active]:shadow-premium-sm transition-all duration-300"
                  >
                    <FileText className="h-4 w-4" />
                    <span className="font-medium">Quotations</span>
                  </TabsTrigger>
                </>
              )}
            </TabsList>

            <div className="flex gap-3">
              {user?.department === "Marine" && (
                <>
                  <TabsContent value="orders" className="m-0">
                    <div
                      className="btn-gradient-glow cursor-pointer"
                      onClick={() => setShowNewOrder(true)}
                    >
                      <span className="btn-gradient-glow-inner">
                        <ClipboardList className="h-5 w-5" />
                        New Marine Order
                      </span>
                    </div>
                  </TabsContent>
                  <TabsContent value="quotations" className="m-0">
                    <div
                      className="btn-gradient-glow cursor-pointer"
                      onClick={() => setShowNewQuotation(true)}
                    >
                      <span className="btn-gradient-glow-inner">
                        <FileText className="h-5 w-5" />
                        New Quotation
                      </span>
                    </div>
                  </TabsContent>
                </>
              )}
              {user?.department === "Property & Engineering" && (
                <>
                  <TabsContent value="property-orders" className="m-0">
                    <Button
                      onClick={() => setShowNewPropertyOrder(true)}
                      className="bg-emerald hover:bg-emerald-dark text-white gap-2 shadow-premium hover:shadow-premium-lg transition-all duration-300"
                    >
                      <ClipboardList className="h-5 w-5" />
                      New P&E Order
                    </Button>
                  </TabsContent>
                  <TabsContent value="property-quotations" className="m-0">
                    <Button
                      onClick={() => setShowNewPropertyQuotation(true)}
                      className="bg-orange-500 hover:bg-orange-600 text-white gap-2 shadow-premium hover:shadow-premium-lg transition-all duration-300"
                    >
                      <FileText className="h-5 w-5" />
                      New Quotation
                    </Button>
                  </TabsContent>
                </>
              )}
              {user?.department === "Liability & Financial" && (
                <>
                  <TabsContent value="liability-orders" className="m-0">
                    <Button
                      onClick={() => setShowNewLiabilityOrder(true)}
                      className="bg-indigo-600 hover:bg-indigo-700 text-white gap-2 shadow-premium hover:shadow-premium-lg transition-all duration-300"
                    >
                      <Shield className="h-5 w-5" />
                      New Liability Order
                    </Button>
                  </TabsContent>
                  <TabsContent value="liability-quotations" className="m-0">
                    <Button
                      onClick={() => setShowNewLiabilityQuotation(true)}
                      className="bg-indigo-600 hover:bg-indigo-700 text-white gap-2 shadow-premium hover:shadow-premium-lg transition-all duration-300"
                    >
                      <FileText className="h-5 w-5" />
                      New Quotation
                    </Button>
                  </TabsContent>
                </>
              )}
            </div>
          </div>

          {/* Content Area with Premium Card */}
          <div className="card-premium p-8">
            {user?.department === "Marine" && (
              <>
                <TabsContent value="orders" className="mt-0">
                  <OrderList />
                </TabsContent>
                <TabsContent value="quotations" className="mt-0">
                  <QuotationList />
                </TabsContent>
              </>
            )}
            {user?.department === "Property & Engineering" && (
              <>
                <TabsContent value="property-orders" className="mt-0">
                  <PropertyEngineeringOrderList />
                </TabsContent>
                <TabsContent value="property-quotations" className="mt-0">
                  <PropertyEngineeringQuotationList />
                </TabsContent>
              </>
            )}
            {user?.department === "Liability & Financial" && (
              <>
                <TabsContent value="liability-orders" className="mt-0">
                  <LiabilityOrderList />
                </TabsContent>
                <TabsContent value="liability-quotations" className="mt-0">
                  <LiabilityQuotationList />
                </TabsContent>
              </>
            )}
          </div>
        </Tabs>

        {/* Premium Dialog Modals */}
        <Dialog open={showNewOrder} onOpenChange={setShowNewOrder}>
          <DialogContent className="dialog-premium max-w-lg p-0 gap-0">
            <DialogHeader className="dialog-header-premium">
              <DialogTitle className="font-display text-xl font-semibold flex items-center gap-3">
                <div className="p-2 rounded-lg bg-gradient-navy">
                  <ClipboardList className="h-5 w-5 text-gold" />
                </div>
                New Marine Order
              </DialogTitle>
            </DialogHeader>
            <div className="dialog-content-premium overflow-y-auto max-h-[calc(90vh-8rem)]">
              <OrderForm onSuccess={() => setShowNewOrder(false)} />
            </div>
          </DialogContent>
        </Dialog>

        <Dialog open={showNewQuotation} onOpenChange={setShowNewQuotation}>
          <DialogContent className="dialog-premium max-w-lg p-0 gap-0">
            <DialogHeader className="dialog-header-premium">
              <DialogTitle className="font-display text-xl font-semibold flex items-center gap-3">
                <div className="p-2 rounded-lg bg-purple-600">
                  <FileText className="h-5 w-5 text-white" />
                </div>
                New Marine Quotation
              </DialogTitle>
            </DialogHeader>
            <div className="dialog-content-premium overflow-y-auto max-h-[calc(90vh-8rem)]">
              <QuotationForm onSuccess={() => setShowNewQuotation(false)} />
            </div>
          </DialogContent>
        </Dialog>

        <Dialog open={showNewPropertyOrder} onOpenChange={setShowNewPropertyOrder}>
          <DialogContent className="dialog-premium max-w-lg p-0 gap-0">
            <DialogHeader className="dialog-header-premium">
              <DialogTitle className="font-display text-xl font-semibold flex items-center gap-3">
                <div className="p-2 rounded-lg bg-emerald">
                  <ClipboardList className="h-5 w-5 text-white" />
                </div>
                New P&E Order
              </DialogTitle>
            </DialogHeader>
            <div className="dialog-content-premium overflow-y-auto max-h-[calc(90vh-8rem)]">
              <PropertyEngineeringOrderForm onSuccess={() => setShowNewPropertyOrder(false)} />
            </div>
          </DialogContent>
        </Dialog>

        <Dialog open={showNewPropertyQuotation} onOpenChange={setShowNewPropertyQuotation}>
          <DialogContent className="dialog-premium max-w-lg p-0 gap-0">
            <DialogHeader className="dialog-header-premium">
              <DialogTitle className="font-display text-xl font-semibold flex items-center gap-3">
                <div className="p-2 rounded-lg bg-orange-500">
                  <FileText className="h-5 w-5 text-white" />
                </div>
                New P&E Quotation
              </DialogTitle>
            </DialogHeader>
            <div className="dialog-content-premium overflow-y-auto max-h-[calc(90vh-8rem)]">
              <PropertyEngineeringQuotationForm onSuccess={() => setShowNewPropertyQuotation(false)} />
            </div>
          </DialogContent>
        </Dialog>

        {user?.department === "Liability & Financial" && (
          <>
            <Dialog open={showNewLiabilityOrder} onOpenChange={setShowNewLiabilityOrder}>
              <DialogContent className="dialog-premium max-w-lg p-0 gap-0">
                <DialogHeader className="dialog-header-premium">
                  <DialogTitle className="font-display text-xl font-semibold flex items-center gap-3">
                    <div className="p-2 rounded-lg bg-indigo-600">
                      <Shield className="h-5 w-5 text-white" />
                    </div>
                    New Liability Order
                  </DialogTitle>
                </DialogHeader>
                <div className="dialog-content-premium overflow-y-auto max-h-[calc(90vh-8rem)]">
                  <LiabilityOrderForm onSuccess={() => setShowNewLiabilityOrder(false)} />
                </div>
              </DialogContent>
            </Dialog>

            <Dialog open={showNewLiabilityQuotation} onOpenChange={setShowNewLiabilityQuotation}>
              <DialogContent className="dialog-premium max-w-lg p-0 gap-0">
                <DialogHeader className="dialog-header-premium">
                  <DialogTitle className="font-display text-xl font-semibold flex items-center gap-3">
                    <div className="p-2 rounded-lg bg-indigo-600">
                      <FileText className="h-5 w-5 text-white" />
                    </div>
                    New Liability Quotation
                  </DialogTitle>
                </DialogHeader>
                <div className="dialog-content-premium overflow-y-auto max-h-[calc(90vh-8rem)]">
                  <LiabilityQuotationForm onSuccess={() => setShowNewLiabilityQuotation(false)} />
                </div>
              </DialogContent>
            </Dialog>
          </>
        )}
      </main>

      {/* Premium Footer Accent */}
      <div className="h-1 bg-gradient-to-r from-navy via-gold to-navy opacity-20" />

      <ScrollToTop />
    </div>
  );
}
