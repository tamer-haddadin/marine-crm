import { useAuth } from "@/hooks/use-auth";
import { Button } from "@/components/ui/button";
import { Link } from "wouter";
import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { Order } from "@shared/schema";
import {
  ArrowLeft,
  Target,
  Calendar,
  CalendarDays,
  Package,
  Anchor,
  BarChart4,
  TrendingUp,
  TrendingDown,
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

export default function KPIPerformancePage() {
  const { user } = useAuth();
  const [selectedYear, setSelectedYear] = useState<number>(2026);
  const [selectedMonth, setSelectedMonth] = useState<number>(0); // 0 = January
  const [activeTab, setActiveTab] = useState<string>("yearly");
  const [breakdownFilter, setBreakdownFilter] = useState<"all" | "cargo" | "hull">("all");

  const availableYears = [2024, 2025, 2026, 2027];
  const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  const monthsFull = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];

  // Fetch all orders
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

  // Annual Targets by year
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

  const getTargetsForYear = (year: number) => {
    return MARINE_TARGETS[year] || MARINE_TARGETS[2026];
  };

  // Product categorization
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

  // Closing rule: 25th of month
  const getProductionMonth = (orderDate: Date | string): { month: number; year: number } => {
    const date = new Date(orderDate);
    const day = date.getDate();
    let month = date.getMonth();
    let year = date.getFullYear();

    if (day > 25) {
      month += 1;
      if (month > 11) {
        month = 0;
        year += 1;
      }
    }

    return { month, year };
  };

  // Format number to millions
  const formatToMillions = (num: number) => {
    if (Math.abs(num) >= 1000000) {
      return (num / 1000000).toFixed(2) + 'M';
    }
    return num.toLocaleString();
  };

  // Current year for comparison (2026 is the "active" year)
  const CURRENT_YEAR = 2026;

  // Calculate yearly KPIs
  // For current year (2026): All orders count
  // For past years: Filter by production year
  const yearlyKPIs = useMemo(() => {
    if (!allOrders) return null;

    // Filter orders based on selected year
    let filteredOrders = allOrders;
    if (selectedYear < CURRENT_YEAR) {
      // For past years, filter by production year
      filteredOrders = allOrders.filter(order => {
        const { year } = getProductionMonth(order.orderDate);
        return year === selectedYear;
      });
    }

    const cargoOrders = filteredOrders.filter(order =>
      MARINE_CARGO_PRODUCTS.includes(order.marineProductType)
    );
    const hullOrders = filteredOrders.filter(order =>
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
  }, [allOrders, selectedYear]);

  // Calculate monthly KPIs
  // For current year (2026): Only January shows all orders, other months show 0
  // For past years: Each month shows its actual production data
  const monthlyKPIs = useMemo(() => {
    if (!allOrders) return null;

    const yearTargets = getTargetsForYear(selectedYear);

    let cargoActual = 0;
    let hullActual = 0;

    if (selectedYear < CURRENT_YEAR) {
      // For past years, filter by production month
      const ordersForMonth = allOrders.filter(order => {
        const { month, year } = getProductionMonth(order.orderDate);
        return month === selectedMonth && year === selectedYear;
      });

      const cargoOrders = ordersForMonth.filter(order =>
        MARINE_CARGO_PRODUCTS.includes(order.marineProductType)
      );
      const hullOrders = ordersForMonth.filter(order =>
        MARINE_HULL_PRODUCTS.includes(order.marineProductType)
      );

      cargoActual = cargoOrders.reduce((sum, order) => {
        const premium = parseFloat(order.premium || "0");
        return sum + (isNaN(premium) ? 0 : premium);
      }, 0);

      hullActual = hullOrders.reduce((sum, order) => {
        const premium = parseFloat(order.premium || "0");
        return sum + (isNaN(premium) ? 0 : premium);
      }, 0);
    } else if (selectedYear === CURRENT_YEAR && selectedMonth === 0) {
      // For current year January, all orders count
      const cargoOrders = allOrders.filter(order =>
        MARINE_CARGO_PRODUCTS.includes(order.marineProductType)
      );
      const hullOrders = allOrders.filter(order =>
        MARINE_HULL_PRODUCTS.includes(order.marineProductType)
      );

      cargoActual = cargoOrders.reduce((sum, order) => {
        const premium = parseFloat(order.premium || "0");
        return sum + (isNaN(premium) ? 0 : premium);
      }, 0);

      hullActual = hullOrders.reduce((sum, order) => {
        const premium = parseFloat(order.premium || "0");
        return sum + (isNaN(premium) ? 0 : premium);
      }, 0);
    }
    // For current year Feb-Dec or future years, actuals remain 0

    const cargoTarget = yearTargets.marineCargo.monthly[selectedMonth];
    const hullTarget = yearTargets.marineHull.monthly[selectedMonth];
    const totalActual = cargoActual + hullActual;
    const totalTarget = cargoTarget + hullTarget;

    return {
      cargo: {
        actual: cargoActual,
        target: cargoTarget,
        variance: cargoActual - cargoTarget,
        progress: cargoTarget > 0 ? (cargoActual / cargoTarget) * 100 : 0
      },
      hull: {
        actual: hullActual,
        target: hullTarget,
        variance: hullActual - hullTarget,
        progress: hullTarget > 0 ? (hullActual / hullTarget) * 100 : 0
      },
      total: {
        actual: totalActual,
        target: totalTarget,
        variance: totalActual - totalTarget,
        progress: totalTarget > 0 ? (totalActual / totalTarget) * 100 : 0
      }
    };
  }, [allOrders, selectedYear, selectedMonth]);

  // Calculate all months comparison data
  // For past years: Show actual data per month
  // For current year (2026): Only January has all data
  const allMonthsData = useMemo(() => {
    if (!allOrders) return [];

    const yearTargets = getTargetsForYear(selectedYear);

    return months.map((_, monthIndex) => {
      const target = yearTargets.marineCargo.monthly[monthIndex] + yearTargets.marineHull.monthly[monthIndex];

      let actual = 0;

      if (selectedYear < CURRENT_YEAR) {
        // For past years, filter by production month
        const ordersForMonth = allOrders.filter(order => {
          const { month, year } = getProductionMonth(order.orderDate);
          return month === monthIndex && year === selectedYear;
        });

        actual = ordersForMonth.reduce((sum, order) => {
          const premium = parseFloat(order.premium || "0");
          return sum + (isNaN(premium) ? 0 : premium);
        }, 0);
      } else if (selectedYear === CURRENT_YEAR && monthIndex === 0) {
        // For current year January, all orders count
        actual = allOrders.reduce((sum, order) => {
          const premium = parseFloat(order.premium || "0");
          return sum + (isNaN(premium) ? 0 : premium);
        }, 0);
      }
      // For current year Feb-Dec or future years, actual remains 0

      const progress = target > 0 ? (actual / target) * 100 : 0;

      return {
        month: months[monthIndex],
        actual,
        target,
        progress,
        isActive: actual > 0
      };
    });
  }, [allOrders, selectedYear]);

  // Monthly breakdown data for the yearly KPI table
  // For past years: Show actual data per month
  // For current year (2026): Only January has all data, other months are 0
  const monthlyBreakdownData = useMemo(() => {
    if (!allOrders) return [];

    const yearTargets = getTargetsForYear(selectedYear);

    return monthsFull.map((monthName, monthIndex) => {
      const cargoTarget = yearTargets.marineCargo.monthly[monthIndex];
      const hullTarget = yearTargets.marineHull.monthly[monthIndex];
      const totalTarget = cargoTarget + hullTarget;

      let cargoActual = 0;
      let hullActual = 0;

      if (selectedYear < CURRENT_YEAR) {
        // For past years, filter by production month
        const ordersForMonth = allOrders.filter(order => {
          const { month, year } = getProductionMonth(order.orderDate);
          return month === monthIndex && year === selectedYear;
        });

        cargoActual = ordersForMonth
          .filter(order => MARINE_CARGO_PRODUCTS.includes(order.marineProductType))
          .reduce((sum, order) => sum + (parseFloat(order.premium || "0") || 0), 0);

        hullActual = ordersForMonth
          .filter(order => MARINE_HULL_PRODUCTS.includes(order.marineProductType))
          .reduce((sum, order) => sum + (parseFloat(order.premium || "0") || 0), 0);
      } else if (selectedYear === CURRENT_YEAR && monthIndex === 0) {
        // For current year January, all orders count
        cargoActual = allOrders
          .filter(order => MARINE_CARGO_PRODUCTS.includes(order.marineProductType))
          .reduce((sum, order) => sum + (parseFloat(order.premium || "0") || 0), 0);

        hullActual = allOrders
          .filter(order => MARINE_HULL_PRODUCTS.includes(order.marineProductType))
          .reduce((sum, order) => sum + (parseFloat(order.premium || "0") || 0), 0);
      }
      // For current year Feb-Dec or future years, actuals remain 0

      let target: number;
      let actual: number;

      if (breakdownFilter === "cargo") {
        target = cargoTarget;
        actual = cargoActual;
      } else if (breakdownFilter === "hull") {
        target = hullTarget;
        actual = hullActual;
      } else {
        target = totalTarget;
        actual = cargoActual + hullActual;
      }

      const variance = actual - target;
      const achievement = target > 0 ? (actual / target) * 100 : 0;

      return {
        month: monthName,
        target,
        actual,
        variance,
        achievement,
        isActive: actual > 0
      };
    });
  }, [allOrders, selectedYear, breakdownFilter]);

  // Calculate totals for the breakdown table
  const breakdownTotals = useMemo(() => {
    if (!monthlyBreakdownData.length) return { target: 0, actual: 0, variance: 0, achievement: 0 };

    const target = monthlyBreakdownData.reduce((sum, m) => sum + m.target, 0);
    const actual = monthlyBreakdownData.reduce((sum, m) => sum + m.actual, 0);
    const variance = actual - target;
    const achievement = target > 0 ? (actual / target) * 100 : 0;

    return { target, actual, variance, achievement };
  }, [monthlyBreakdownData]);

  if (user?.department !== "Marine") {
    return (
      <div className="dashboard-bg min-h-screen flex items-center justify-center">
        <div className="text-center">
          <h2 className="font-display text-2xl font-semibold text-foreground mb-2">
            Access Restricted
          </h2>
          <p className="text-muted-foreground">
            KPI Performance is only available for Marine department.
          </p>
          <Link href="/">
            <Button className="mt-4">Back to Dashboard</Button>
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="dashboard-bg min-h-screen">
      {/* Header */}
      <header className="header-premium">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex justify-between items-center">
            <div className="flex items-center gap-4">
              <Link href="/">
                <Button variant="outline" size="sm" className="gap-2">
                  <ArrowLeft className="h-4 w-4" />
                  Back
                </Button>
              </Link>
              <div className="flex items-center gap-3">
                <div className="p-2.5 rounded-xl bg-gold/10 border border-gold/20">
                  <Target className="h-6 w-6 text-gold" />
                </div>
                <h1 className="font-display text-2xl font-semibold text-foreground">
                  KPI <span className="text-gold">Performance</span>
                </h1>
              </div>
            </div>

            <div className="flex items-center gap-3">
              <Select
                value={selectedYear.toString()}
                onValueChange={(value) => setSelectedYear(parseInt(value))}
              >
                <SelectTrigger className="w-[180px] h-10 bg-emerald text-white border-emerald hover:bg-emerald/90 shadow-premium-sm font-semibold">
                  <span className="whitespace-nowrap">Target Year: {selectedYear}</span>
                </SelectTrigger>
                <SelectContent className="bg-card border-border shadow-premium-lg">
                  {availableYears.map((year) => (
                    <SelectItem
                      key={year}
                      value={year.toString()}
                      className="cursor-pointer hover:bg-muted/50"
                    >
                      {year}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <span className="px-3 py-2 rounded-lg bg-amber-500 text-white font-semibold text-sm flex items-center gap-2">
                <CircleDot className="h-3.5 w-3.5" />
                Closing: 25th
              </span>
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10">
        {/* Yearly/Monthly Toggle */}
        <div className="flex justify-center mb-10">
          <Tabs value={activeTab} onValueChange={setActiveTab} className="w-auto">
            <TabsList className="bg-card p-1.5 rounded-xl border border-border shadow-premium-sm">
              <TabsTrigger
                value="yearly"
                className="rounded-lg gap-2 px-6 py-3 data-[state=active]:bg-navy data-[state=active]:text-white data-[state=active]:shadow-premium-sm transition-all duration-300"
              >
                <Calendar className="h-4 w-4" />
                <span className="font-medium">Yearly KPI</span>
              </TabsTrigger>
              <TabsTrigger
                value="monthly"
                className="rounded-lg gap-2 px-6 py-3 data-[state=active]:bg-navy data-[state=active]:text-white data-[state=active]:shadow-premium-sm transition-all duration-300"
              >
                <CalendarDays className="h-4 w-4" />
                <span className="font-medium">Monthly KPI</span>
              </TabsTrigger>
            </TabsList>
          </Tabs>
        </div>

        {/* Yearly KPI Content */}
        {activeTab === "yearly" && yearlyKPIs && (
          <div className="animate-fade-in">
            {/* Section Header */}
            <div className="flex items-center gap-3 mb-6">
              <BarChart4 className="h-6 w-6 text-navy" />
              <h2 className="font-display text-2xl font-semibold text-foreground">
                Annual Target Summary
              </h2>
            </div>

            {/* KPI Cards Grid */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {/* Marine Cargo Card */}
              <div className="card-premium p-6">
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center gap-3">
                    <div className="p-2 rounded-lg bg-cyan-500/10">
                      <Package className="h-5 w-5 text-cyan-600" />
                    </div>
                    <span className="font-semibold text-cyan-600">Marine Cargo</span>
                  </div>
                  <TrendingDown className="h-5 w-5 text-red-400" />
                </div>
                <p className="text-sm text-muted-foreground mb-4">
                  Annual Target: <span className="font-semibold text-foreground">AED {formatToMillions(yearlyKPIs.cargo.target)}</span>
                </p>

                <div className="space-y-2 mb-4">
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-muted-foreground">Progress</span>
                    <span className={`font-semibold text-xl ${yearlyKPIs.cargo.progress >= 100 ? 'text-emerald' : 'text-amber-600'}`}>
                      {yearlyKPIs.cargo.progress.toFixed(1)}%
                    </span>
                  </div>
                  <div className="h-3 bg-muted rounded-full overflow-hidden">
                    <div
                      className={`h-full rounded-full transition-all duration-500 ${
                        yearlyKPIs.cargo.progress >= 100 ? 'bg-emerald' : yearlyKPIs.cargo.progress >= 50 ? 'bg-amber-500' : 'bg-red-500'
                      }`}
                      style={{ width: `${Math.min(yearlyKPIs.cargo.progress, 100)}%` }}
                    />
                  </div>
                </div>

                <div className="flex items-center justify-between pt-4 border-t border-border">
                  <div>
                    <p className="text-xs text-muted-foreground mb-1">Actual Premium</p>
                    <p className="font-mono font-semibold text-lg text-foreground">
                      AED {formatToMillions(yearlyKPIs.cargo.actual)}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="text-xs text-muted-foreground mb-1">Variance</p>
                    <p className={`font-mono font-semibold text-lg ${yearlyKPIs.cargo.variance >= 0 ? 'text-emerald' : 'text-red-500'}`}>
                      AED {yearlyKPIs.cargo.variance.toLocaleString(undefined, { maximumFractionDigits: 0 })}
                    </p>
                  </div>
                </div>
              </div>

              {/* Marine Hull Card */}
              <div className="card-premium p-6">
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center gap-3">
                    <div className="p-2 rounded-lg bg-blue-500/10">
                      <Anchor className="h-5 w-5 text-blue-600" />
                    </div>
                    <span className="font-semibold text-blue-600">Marine Hull</span>
                  </div>
                  <TrendingDown className="h-5 w-5 text-red-400" />
                </div>
                <p className="text-sm text-muted-foreground mb-4">
                  Annual Target: <span className="font-semibold text-foreground">AED {formatToMillions(yearlyKPIs.hull.target)}</span>
                </p>

                <div className="space-y-2 mb-4">
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-muted-foreground">Progress</span>
                    <span className={`font-semibold text-xl ${yearlyKPIs.hull.progress >= 100 ? 'text-emerald' : 'text-amber-600'}`}>
                      {yearlyKPIs.hull.progress.toFixed(1)}%
                    </span>
                  </div>
                  <div className="h-3 bg-muted rounded-full overflow-hidden">
                    <div
                      className={`h-full rounded-full transition-all duration-500 ${
                        yearlyKPIs.hull.progress >= 100 ? 'bg-emerald' : yearlyKPIs.hull.progress >= 50 ? 'bg-amber-500' : 'bg-red-500'
                      }`}
                      style={{ width: `${Math.min(yearlyKPIs.hull.progress, 100)}%` }}
                    />
                  </div>
                </div>

                <div className="flex items-center justify-between pt-4 border-t border-border">
                  <div>
                    <p className="text-xs text-muted-foreground mb-1">Actual Premium</p>
                    <p className="font-mono font-semibold text-lg text-foreground">
                      AED {formatToMillions(yearlyKPIs.hull.actual)}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="text-xs text-muted-foreground mb-1">Variance</p>
                    <p className={`font-mono font-semibold text-lg ${yearlyKPIs.hull.variance >= 0 ? 'text-emerald' : 'text-red-500'}`}>
                      AED {yearlyKPIs.hull.variance.toLocaleString(undefined, { maximumFractionDigits: 0 })}
                    </p>
                  </div>
                </div>
              </div>

              {/* Total Marine Card */}
              <div className="card-gold-accent p-6">
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center gap-3">
                    <div className="p-2 rounded-lg bg-purple-500/10">
                      <BarChart4 className="h-5 w-5 text-purple-600" />
                    </div>
                    <span className="font-semibold text-purple-600">Total Marine</span>
                  </div>
                  <TrendingDown className="h-5 w-5 text-red-400" />
                </div>
                <p className="text-sm text-muted-foreground mb-4">
                  Annual Target: <span className="font-semibold text-foreground">AED {formatToMillions(yearlyKPIs.total.target)}</span>
                </p>

                <div className="space-y-2 mb-4">
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-muted-foreground">Progress</span>
                    <span className={`font-semibold text-xl ${yearlyKPIs.total.progress >= 100 ? 'text-emerald' : 'text-amber-600'}`}>
                      {yearlyKPIs.total.progress.toFixed(1)}%
                    </span>
                  </div>
                  <div className="h-3 bg-purple-200 dark:bg-purple-900/30 rounded-full overflow-hidden">
                    <div
                      className={`h-full rounded-full transition-all duration-500 ${
                        yearlyKPIs.total.progress >= 100 ? 'bg-emerald' : yearlyKPIs.total.progress >= 50 ? 'bg-purple-500' : 'bg-red-500'
                      }`}
                      style={{ width: `${Math.min(yearlyKPIs.total.progress, 100)}%` }}
                    />
                  </div>
                </div>

                <div className="flex items-center justify-between pt-4 border-t border-border">
                  <div>
                    <p className="text-xs text-muted-foreground mb-1">Actual Premium</p>
                    <p className="font-mono font-semibold text-lg text-foreground">
                      AED {formatToMillions(yearlyKPIs.total.actual)}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="text-xs text-muted-foreground mb-1">Variance</p>
                    <p className={`font-mono font-semibold text-lg ${yearlyKPIs.total.variance >= 0 ? 'text-emerald' : 'text-red-500'}`}>
                      AED {yearlyKPIs.total.variance.toLocaleString(undefined, { maximumFractionDigits: 0 })}
                    </p>
                  </div>
                </div>
              </div>
            </div>

            {/* Monthly Performance Breakdown Table */}
            <div className="mt-10 card-premium p-6">
              <div className="mb-6">
                <div className="flex items-center gap-3 mb-2">
                  <CalendarDays className="h-6 w-6 text-navy" />
                  <h3 className="font-display text-xl font-semibold text-foreground">
                    Monthly Performance Breakdown
                  </h3>
                </div>
                <p className="text-sm text-muted-foreground">
                  Month-by-month target vs actual (Closing: 25th of each month)
                </p>
              </div>

              {/* Filter Tabs */}
              <div className="flex gap-2 mb-6">
                <button
                  onClick={() => setBreakdownFilter("all")}
                  className={`px-6 py-2.5 rounded-lg font-medium text-sm transition-all duration-200 border ${
                    breakdownFilter === "all"
                      ? 'bg-card border-border shadow-premium-sm text-foreground'
                      : 'bg-transparent border-transparent text-muted-foreground hover:text-foreground'
                  }`}
                >
                  All Marine
                </button>
                <button
                  onClick={() => setBreakdownFilter("cargo")}
                  className={`px-6 py-2.5 rounded-lg font-medium text-sm transition-all duration-200 border ${
                    breakdownFilter === "cargo"
                      ? 'bg-card border-border shadow-premium-sm text-foreground'
                      : 'bg-transparent border-transparent text-muted-foreground hover:text-foreground'
                  }`}
                >
                  Marine Cargo
                </button>
                <button
                  onClick={() => setBreakdownFilter("hull")}
                  className={`px-6 py-2.5 rounded-lg font-medium text-sm transition-all duration-200 border ${
                    breakdownFilter === "hull"
                      ? 'bg-card border-border shadow-premium-sm text-foreground'
                      : 'bg-transparent border-transparent text-muted-foreground hover:text-foreground'
                  }`}
                >
                  Marine Hull
                </button>
              </div>

              {/* Table */}
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b border-border">
                      <th className="text-left py-3 px-4 text-sm font-semibold text-muted-foreground">Month</th>
                      <th className="text-right py-3 px-4 text-sm font-semibold text-muted-foreground">Target</th>
                      <th className="text-right py-3 px-4 text-sm font-semibold text-muted-foreground">Actual</th>
                      <th className="text-right py-3 px-4 text-sm font-semibold text-muted-foreground">Variance</th>
                      <th className="text-right py-3 px-4 text-sm font-semibold text-muted-foreground">Achievement</th>
                      <th className="py-3 px-4 text-sm font-semibold text-muted-foreground w-32">Progress</th>
                    </tr>
                  </thead>
                  <tbody>
                    {monthlyBreakdownData.map((row, index) => (
                      <tr key={row.month} className="border-b border-border/50 hover:bg-muted/30 transition-colors">
                        <td className="py-3 px-4">
                          <div className="flex items-center gap-2">
                            <span className="font-medium text-foreground">{row.month}</span>
                            {row.isActive && (
                              <span className="px-2 py-0.5 text-[10px] rounded bg-red-500 text-white font-semibold">
                                Active
                              </span>
                            )}
                          </div>
                        </td>
                        <td className="text-right py-3 px-4 font-mono text-sm text-muted-foreground">
                          AED {row.target.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                        </td>
                        <td className="text-right py-3 px-4 font-mono text-sm font-semibold text-foreground">
                          AED {row.actual.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                        </td>
                        <td className={`text-right py-3 px-4 font-mono text-sm font-semibold ${row.variance >= 0 ? 'text-emerald' : 'text-red-500'}`}>
                          AED {row.variance.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                        </td>
                        <td className="text-right py-3 px-4">
                          <span className={`inline-block px-2 py-1 rounded text-xs font-semibold ${
                            row.achievement >= 100 ? 'bg-emerald/10 text-emerald' :
                            row.achievement >= 50 ? 'bg-amber-500/10 text-amber-600' :
                            'bg-muted text-muted-foreground'
                          }`}>
                            {row.achievement.toFixed(1)}%
                          </span>
                        </td>
                        <td className="py-3 px-4">
                          <div className="h-2 bg-muted rounded-full overflow-hidden">
                            <div
                              className={`h-full rounded-full transition-all duration-500 ${
                                row.achievement >= 100 ? 'bg-emerald' :
                                row.achievement >= 50 ? 'bg-blue-500' :
                                row.achievement > 0 ? 'bg-blue-400' :
                                'bg-muted'
                              }`}
                              style={{ width: `${Math.min(row.achievement, 100)}%` }}
                            />
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot>
                    <tr className="bg-muted/30 font-semibold">
                      <td className="py-3 px-4 text-foreground">Total</td>
                      <td className="text-right py-3 px-4 font-mono text-sm text-muted-foreground">
                        AED {breakdownTotals.target.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                      </td>
                      <td className="text-right py-3 px-4 font-mono text-sm text-foreground">
                        AED {breakdownTotals.actual.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                      </td>
                      <td className={`text-right py-3 px-4 font-mono text-sm ${breakdownTotals.variance >= 0 ? 'text-emerald' : 'text-red-500'}`}>
                        AED {breakdownTotals.variance.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                      </td>
                      <td className="text-right py-3 px-4">
                        <span className={`inline-block px-2 py-1 rounded text-xs font-semibold ${
                          breakdownTotals.achievement >= 100 ? 'bg-emerald/10 text-emerald' :
                          breakdownTotals.achievement >= 50 ? 'bg-amber-500/10 text-amber-600' :
                          'bg-red-500/10 text-red-500'
                        }`}>
                          {breakdownTotals.achievement.toFixed(1)}%
                        </span>
                      </td>
                      <td className="py-3 px-4">
                        <div className="h-2 bg-muted rounded-full overflow-hidden">
                          <div
                            className={`h-full rounded-full transition-all duration-500 ${
                              breakdownTotals.achievement >= 100 ? 'bg-emerald' :
                              breakdownTotals.achievement >= 50 ? 'bg-amber-500' :
                              'bg-red-500'
                            }`}
                            style={{ width: `${Math.min(breakdownTotals.achievement, 100)}%` }}
                          />
                        </div>
                      </td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* Monthly KPI Content */}
        {activeTab === "monthly" && monthlyKPIs && (
          <div className="animate-fade-in space-y-8">
            {/* Month Selector */}
            <div className="card-premium p-6">
              <div className="flex items-center gap-3 mb-5">
                <CalendarDays className="h-5 w-5 text-navy" />
                <h3 className="font-semibold text-foreground text-lg">Select Month</h3>
              </div>
              <div className="grid grid-cols-12 gap-2">
                {months.map((month, index) => (
                  <button
                    key={month}
                    onClick={() => setSelectedMonth(index)}
                    className={`py-3 rounded-lg font-medium text-sm transition-all duration-200 ${
                      selectedMonth === index
                        ? 'bg-navy text-white shadow-premium-sm'
                        : 'bg-muted/50 text-foreground hover:bg-muted border border-border'
                    }`}
                  >
                    {month}
                  </button>
                ))}
              </div>
            </div>

            {/* Monthly Performance Header */}
            <div className="flex items-center gap-3">
              <CalendarDays className="h-6 w-6 text-navy" />
              <h2 className="font-display text-2xl font-semibold text-foreground">
                {monthsFull[selectedMonth]} {selectedYear} Performance
              </h2>
            </div>

            {/* Monthly KPI Cards */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {/* Marine Cargo Monthly */}
              <div className="card-premium p-6">
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center gap-3">
                    <div className="p-2 rounded-lg bg-cyan-500/10">
                      <Package className="h-5 w-5 text-cyan-600" />
                    </div>
                    <span className="font-semibold text-cyan-600">Marine Cargo</span>
                  </div>
                  <TrendingDown className="h-5 w-5 text-muted-foreground/50" />
                </div>
                <p className="text-sm text-muted-foreground mb-4">
                  Monthly Target: <span className="font-semibold text-foreground">AED {formatToMillions(monthlyKPIs.cargo.target)}</span>
                </p>

                <div className="space-y-2 mb-4">
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-muted-foreground">Progress</span>
                    <span className={`font-semibold text-xl ${monthlyKPIs.cargo.progress >= 100 ? 'text-emerald' : 'text-amber-600'}`}>
                      {monthlyKPIs.cargo.progress.toFixed(1)}%
                    </span>
                  </div>
                  <div className="h-3 bg-cyan-100 dark:bg-cyan-900/30 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-cyan-500 rounded-full transition-all duration-500"
                      style={{ width: `${Math.min(monthlyKPIs.cargo.progress, 100)}%` }}
                    />
                  </div>
                </div>

                <div className="flex items-center justify-between pt-4 border-t border-border">
                  <div>
                    <p className="text-xs text-muted-foreground mb-1">Actual</p>
                    <p className="font-mono font-semibold text-lg text-foreground">
                      AED {monthlyKPIs.cargo.actual > 0 ? formatToMillions(monthlyKPIs.cargo.actual) : '0'}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="text-xs text-muted-foreground mb-1">Variance</p>
                    <p className={`font-mono font-semibold text-lg ${monthlyKPIs.cargo.variance >= 0 ? 'text-emerald' : 'text-red-500'}`}>
                      AED {monthlyKPIs.cargo.variance.toLocaleString(undefined, { maximumFractionDigits: 0 })}
                    </p>
                  </div>
                </div>
              </div>

              {/* Marine Hull Monthly */}
              <div className="card-premium p-6">
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center gap-3">
                    <div className="p-2 rounded-lg bg-blue-500/10">
                      <Anchor className="h-5 w-5 text-blue-600" />
                    </div>
                    <span className="font-semibold text-blue-600">Marine Hull</span>
                  </div>
                  <TrendingDown className="h-5 w-5 text-muted-foreground/50" />
                </div>
                <p className="text-sm text-muted-foreground mb-4">
                  Monthly Target: <span className="font-semibold text-foreground">AED {formatToMillions(monthlyKPIs.hull.target)}</span>
                </p>

                <div className="space-y-2 mb-4">
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-muted-foreground">Progress</span>
                    <span className={`font-semibold text-xl ${monthlyKPIs.hull.progress >= 100 ? 'text-emerald' : 'text-amber-600'}`}>
                      {monthlyKPIs.hull.progress.toFixed(1)}%
                    </span>
                  </div>
                  <div className="h-3 bg-blue-100 dark:bg-blue-900/30 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-blue-500 rounded-full transition-all duration-500"
                      style={{ width: `${Math.min(monthlyKPIs.hull.progress, 100)}%` }}
                    />
                  </div>
                </div>

                <div className="flex items-center justify-between pt-4 border-t border-border">
                  <div>
                    <p className="text-xs text-muted-foreground mb-1">Actual</p>
                    <p className="font-mono font-semibold text-lg text-foreground">
                      AED {monthlyKPIs.hull.actual > 0 ? formatToMillions(monthlyKPIs.hull.actual) : '0'}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="text-xs text-muted-foreground mb-1">Variance</p>
                    <p className={`font-mono font-semibold text-lg ${monthlyKPIs.hull.variance >= 0 ? 'text-emerald' : 'text-red-500'}`}>
                      AED {monthlyKPIs.hull.variance.toLocaleString(undefined, { maximumFractionDigits: 0 })}
                    </p>
                  </div>
                </div>
              </div>

              {/* Total Marine Monthly */}
              <div className="card-gold-accent p-6">
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center gap-3">
                    <div className="p-2 rounded-lg bg-purple-500/10">
                      <BarChart4 className="h-5 w-5 text-purple-600" />
                    </div>
                    <span className="font-semibold text-purple-600">Total Marine</span>
                  </div>
                  <TrendingDown className="h-5 w-5 text-muted-foreground/50" />
                </div>
                <p className="text-sm text-muted-foreground mb-4">
                  Monthly Target: <span className="font-semibold text-foreground">AED {formatToMillions(monthlyKPIs.total.target)}</span>
                </p>

                <div className="space-y-2 mb-4">
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-muted-foreground">Progress</span>
                    <span className={`font-semibold text-xl ${monthlyKPIs.total.progress >= 100 ? 'text-emerald' : 'text-amber-600'}`}>
                      {monthlyKPIs.total.progress.toFixed(1)}%
                    </span>
                  </div>
                  <div className="h-3 bg-purple-200 dark:bg-purple-900/30 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-purple-500 rounded-full transition-all duration-500"
                      style={{ width: `${Math.min(monthlyKPIs.total.progress, 100)}%` }}
                    />
                  </div>
                </div>

                <div className="flex items-center justify-between pt-4 border-t border-border">
                  <div>
                    <p className="text-xs text-muted-foreground mb-1">Actual</p>
                    <p className="font-mono font-semibold text-lg text-foreground">
                      AED {monthlyKPIs.total.actual > 0 ? formatToMillions(monthlyKPIs.total.actual) : '0'}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="text-xs text-muted-foreground mb-1">Variance</p>
                    <p className={`font-mono font-semibold text-lg ${monthlyKPIs.total.variance >= 0 ? 'text-emerald' : 'text-red-500'}`}>
                      AED {monthlyKPIs.total.variance.toLocaleString(undefined, { maximumFractionDigits: 0 })}
                    </p>
                  </div>
                </div>
              </div>
            </div>

            {/* Monthly Comparison Chart */}
            <div className="card-premium p-6">
              <div className="mb-4">
                <h3 className="font-semibold text-foreground text-lg">Monthly Target vs Actual Comparison</h3>
                <p className="text-sm text-muted-foreground">Visual comparison of all months (Closing: 25th)</p>
              </div>
              <div className="space-y-3">
                {allMonthsData.map((data, index) => (
                  <div key={data.month} className="flex items-center gap-4">
                    {/* Month Label */}
                    <div className="w-20 flex items-center gap-2 shrink-0">
                      <span className="font-medium text-sm text-foreground">{data.month}</span>
                      {data.isActive && data.actual > 0 && (
                        <span className="px-1.5 py-0.5 text-[9px] rounded-full bg-emerald/20 text-emerald font-semibold border border-emerald/30">
                          Live
                        </span>
                      )}
                    </div>
                    {/* Progress Bar */}
                    <div className="flex-1 h-3 bg-muted/50 rounded-full overflow-hidden">
                      <div
                        className={`h-full rounded-full transition-all duration-500 ${
                          data.progress >= 100 ? 'bg-emerald' : data.progress >= 50 ? 'bg-amber-500' : 'bg-amber-500/70'
                        }`}
                        style={{ width: `${Math.min(data.progress, 100)}%` }}
                      />
                    </div>
                    {/* Values */}
                    <div className="w-56 flex items-center justify-end gap-4 shrink-0">
                      <div className="flex items-center gap-1 text-sm">
                        <span className="text-muted-foreground">Actual:</span>
                        <span className="font-mono font-medium text-foreground">
                          {formatToMillions(data.actual)}
                        </span>
                      </div>
                      <div className="flex items-center gap-1 text-sm">
                        <span className="text-muted-foreground">Target:</span>
                        <span className="font-mono font-medium text-muted-foreground">
                          {formatToMillions(data.target)}
                        </span>
                      </div>
                      <span className={`font-mono font-bold text-sm w-12 text-right ${data.progress >= 100 ? 'text-emerald' : 'text-amber-500'}`}>
                        {data.progress.toFixed(0)}%
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}
      </main>

      {/* Footer Accent */}
      <div className="h-1 bg-gradient-to-r from-navy via-gold to-navy opacity-20" />
    </div>
  );
}
