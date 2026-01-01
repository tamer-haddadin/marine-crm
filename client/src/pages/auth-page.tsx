import { useAuth } from "@/hooks/use-auth";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { insertUserSchema, LINES_OF_BUSINESS } from "@shared/schema";
import { useLocation } from "wouter";
import { Shield, Lock, User, FileText, Sparkles, ArrowRight, Check, Building2 } from "lucide-react";
import { motion } from "framer-motion";
import { useEffect } from "react";
import { z } from "zod";

// Create a login schema that only requires username and password
const loginSchema = z.object({
  username: z.string().min(1, "Username is required"),
  password: z.string().min(1, "Password is required"),
});

type LoginFormData = z.infer<typeof loginSchema>;

// Premium animated background
const PremiumBackground = () => (
  <div className="absolute inset-0 -z-10 overflow-hidden">
    {/* Base gradient */}
    <div className="absolute inset-0 bg-gradient-to-br from-slate-50 via-blue-50/50 to-amber-50/30 dark:from-slate-950 dark:via-blue-950/50 dark:to-slate-900" />

    {/* Decorative orbs */}
    <div className="absolute top-0 left-0 w-[600px] h-[600px] bg-navy/5 dark:bg-navy-light/10 rounded-full blur-3xl -translate-x-1/2 -translate-y-1/2" />
    <div className="absolute bottom-0 right-0 w-[500px] h-[500px] bg-gold/10 dark:bg-gold/5 rounded-full blur-3xl translate-x-1/4 translate-y-1/4" />
    <div className="absolute top-1/2 left-1/2 w-[400px] h-[400px] bg-emerald/5 dark:bg-emerald/5 rounded-full blur-3xl -translate-x-1/2 -translate-y-1/2" />

    {/* Subtle grid pattern */}
    <div
      className="absolute inset-0 opacity-[0.015] dark:opacity-[0.02]"
      style={{
        backgroundImage: `url("data:image/svg+xml,%3Csvg width='60' height='60' viewBox='0 0 60 60' xmlns='http://www.w3.org/2000/svg'%3E%3Cg fill='none' fill-rule='evenodd'%3E%3Cg fill='%23000000' fill-opacity='1'%3E%3Cpath d='M36 34v-4h-2v4h-4v2h4v4h2v-4h4v-2h-4zm0-30V0h-2v4h-4v2h4v4h2V6h4V4h-4zM6 34v-4H4v4H0v2h4v4h2v-4h4v-2H6zM6 4V0H4v4H0v2h4v4h2V6h4V4H6z'/%3E%3C/g%3E%3C/g%3E%3C/svg%3E")`,
      }}
    />
  </div>
);

// Feature item component
const FeatureItem = ({ icon: Icon, title, description }: { icon: any; title: string; description: string }) => (
  <motion.div
    className="flex items-start gap-4 p-5 rounded-xl bg-white/60 dark:bg-white/5 backdrop-blur-sm border border-white/50 dark:border-white/10 shadow-premium-sm"
    whileHover={{ y: -4, transition: { duration: 0.2 } }}
  >
    <div className="flex-shrink-0 w-11 h-11 rounded-xl bg-gradient-navy flex items-center justify-center shadow-premium-sm">
      <Icon className="w-5 h-5 text-gold" />
    </div>
    <div>
      <h3 className="font-semibold text-foreground mb-1">{title}</h3>
      <p className="text-sm text-muted-foreground leading-relaxed">{description}</p>
    </div>
  </motion.div>
);

export default function AuthPage() {
  const { user, loginMutation, registerMutation } = useAuth();
  const [, setLocation] = useLocation();

  useEffect(() => {
    if (user) {
      setLocation("/");
    }
  }, [user, setLocation]);

  if (user) {
    return null;
  }

  return (
    <div className="min-h-screen flex items-center justify-center py-12 px-4 sm:px-6 lg:px-8 relative">
      <PremiumBackground />

      <div className="w-full max-w-7xl grid grid-cols-1 lg:grid-cols-5 gap-16 z-10">
        {/* Left side - Branding & Features */}
        <motion.div
          className="lg:col-span-3 hidden lg:flex flex-col justify-center"
          initial={{ opacity: 0, x: -30 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.7, ease: [0.22, 1, 0.36, 1] }}
        >
          <div className="space-y-10 px-4">
            {/* Platform Logo */}
            <motion.div
              initial={{ scale: 0.8, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              transition={{ delay: 0.2, duration: 0.5 }}
            >
              <img
                src="/platform-logo.png"
                alt="Insurance Platform"
                className="h-24 w-auto object-contain drop-shadow-2xl"
              />
            </motion.div>

            {/* Main headline */}
            <div className="space-y-4">
              <motion.h1
                className="font-display text-5xl lg:text-6xl font-semibold tracking-tight"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.3, duration: 0.6 }}
              >
                <span className="text-foreground">Insurance</span>
                <br />
                <span className="text-gradient-premium">Underwriting</span>
              </motion.h1>
              <motion.p
                className="text-xl text-muted-foreground leading-relaxed max-w-lg"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.4, duration: 0.6 }}
              >
                Enterprise-grade platform designed for marine, property, and liability insurance professionals.
              </motion.p>
            </div>

            {/* Feature cards */}
            <motion.div
              className="grid grid-cols-1 sm:grid-cols-2 gap-4"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.5, duration: 0.6 }}
            >
              <FeatureItem
                icon={FileText}
                title="Smart Quotations"
                description="AI-powered risk assessment and automated quotation generation across all business lines."
              />
              <FeatureItem
                icon={Shield}
                title="Secure Platform"
                description="Enterprise security with role-based access and complete audit trails."
              />
            </motion.div>

            {/* Trust indicators */}
            <motion.div
              className="flex items-center gap-6 text-sm text-muted-foreground"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.7, duration: 0.6 }}
            >
              <div className="flex items-center gap-2">
                <Check className="w-4 h-4 text-emerald" />
                <span>SOC 2 Compliant</span>
              </div>
              <div className="flex items-center gap-2">
                <Check className="w-4 h-4 text-emerald" />
                <span>256-bit Encryption</span>
              </div>
              <div className="flex items-center gap-2">
                <Check className="w-4 h-4 text-emerald" />
                <span>99.9% Uptime</span>
              </div>
            </motion.div>
          </div>
        </motion.div>

        {/* Right side - Auth Card */}
        <motion.div
          className="lg:col-span-2 w-full max-w-md mx-auto"
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.7, ease: [0.22, 1, 0.36, 1] }}
        >
          <Card className="card-premium overflow-hidden border-0">
            {/* Gold accent line */}
            <div className="h-1 bg-gradient-to-r from-gold via-gold-light to-gold" />

            <CardHeader className="space-y-4 pt-8 pb-2 px-8">
              <div className="flex justify-center">
                <img
                  src="/platform-logo.png"
                  alt="Insurance Platform"
                  className="h-16 w-auto object-contain drop-shadow-lg"
                />
              </div>
              <div className="text-center space-y-2">
                <h2 className="font-display text-2xl font-semibold text-foreground">
                  Welcome Back
                </h2>
                <p className="text-sm text-muted-foreground">
                  Sign in to your insurance underwriting dashboard
                </p>
              </div>
            </CardHeader>

            <CardContent className="px-8 pb-8">
              <Tabs defaultValue="login" className="w-full">
                <TabsList className="grid w-full grid-cols-2 mb-8 bg-muted/50 p-1 rounded-lg">
                  <TabsTrigger
                    value="login"
                    className="rounded-md data-[state=active]:bg-white dark:data-[state=active]:bg-card data-[state=active]:shadow-premium-sm font-medium transition-all duration-300"
                  >
                    Sign In
                  </TabsTrigger>
                  <TabsTrigger
                    value="register"
                    className="rounded-md data-[state=active]:bg-white dark:data-[state=active]:bg-card data-[state=active]:shadow-premium-sm font-medium transition-all duration-300"
                  >
                    Register
                  </TabsTrigger>
                </TabsList>

                <TabsContent value="login">
                  <LoginForm onSubmit={(data) => loginMutation.mutate(data)} isLoading={loginMutation.isPending} />
                </TabsContent>
                <TabsContent value="register">
                  <RegisterForm onSubmit={(data) => registerMutation.mutate(data)} isLoading={registerMutation.isPending} />
                </TabsContent>
              </Tabs>
            </CardContent>
          </Card>

          {/* Bottom text */}
          <p className="text-center text-xs text-muted-foreground mt-6">
            Protected by enterprise-grade security
          </p>
        </motion.div>
      </div>
    </div>
  );
}

function LoginForm({ onSubmit, isLoading }: { onSubmit: (data: LoginFormData) => void; isLoading: boolean }) {
  const form = useForm<LoginFormData>({
    resolver: zodResolver(loginSchema),
    defaultValues: {
      username: "",
      password: "",
    },
  });

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-5">
        <FormField
          control={form.control}
          name="username"
          render={({ field }) => (
            <FormItem>
              <FormLabel className="text-sm font-medium text-foreground">
                Username
              </FormLabel>
              <FormControl>
                <div className="relative">
                  <User className="absolute left-4 top-1/2 transform -translate-y-1/2 text-muted-foreground h-4 w-4" />
                  <Input
                    className="input-premium pl-11 h-12"
                    placeholder="Enter your username"
                    {...field}
                  />
                </div>
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="password"
          render={({ field }) => (
            <FormItem>
              <FormLabel className="text-sm font-medium text-foreground">
                Password
              </FormLabel>
              <FormControl>
                <div className="relative">
                  <Lock className="absolute left-4 top-1/2 transform -translate-y-1/2 text-muted-foreground h-4 w-4" />
                  <Input
                    type="password"
                    className="input-premium pl-11 h-12"
                    placeholder="Enter your password"
                    {...field}
                  />
                </div>
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <Button
          type="submit"
          disabled={isLoading}
          className="btn-luxury w-full h-12 mt-2"
        >
          {isLoading ? (
            <span className="flex items-center gap-2">
              <span className="w-4 h-4 border-2 border-gold/30 border-t-gold rounded-full animate-spin" />
              Signing in...
            </span>
          ) : (
            <span className="flex items-center gap-2">
              Sign In
              <ArrowRight className="w-4 h-4" />
            </span>
          )}
        </Button>
      </form>
    </Form>
  );
}

function RegisterForm({ onSubmit, isLoading }: { onSubmit: (data: any) => void; isLoading: boolean }) {
  const form = useForm({
    resolver: zodResolver(insertUserSchema),
    defaultValues: {
      username: "",
      password: "",
      department: undefined,
    },
  });

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-5">
        <FormField
          control={form.control}
          name="username"
          render={({ field }) => (
            <FormItem>
              <FormLabel className="text-sm font-medium text-foreground">
                Username
              </FormLabel>
              <FormControl>
                <div className="relative">
                  <User className="absolute left-4 top-1/2 transform -translate-y-1/2 text-muted-foreground h-4 w-4" />
                  <Input
                    className="input-premium pl-11 h-12"
                    placeholder="Choose a username"
                    {...field}
                  />
                </div>
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="password"
          render={({ field }) => (
            <FormItem>
              <FormLabel className="text-sm font-medium text-foreground">
                Password
              </FormLabel>
              <FormControl>
                <div className="relative">
                  <Lock className="absolute left-4 top-1/2 transform -translate-y-1/2 text-muted-foreground h-4 w-4" />
                  <Input
                    type="password"
                    className="input-premium pl-11 h-12"
                    placeholder="Create a password"
                    {...field}
                  />
                </div>
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="department"
          render={({ field }) => (
            <FormItem>
              <FormLabel className="text-sm font-medium text-foreground">
                Department
              </FormLabel>
              <FormControl>
                <div className="relative">
                  <Building2 className="absolute left-4 top-1/2 transform -translate-y-1/2 text-muted-foreground h-4 w-4 z-10 pointer-events-none" />
                  <Select onValueChange={field.onChange} value={field.value}>
                    <SelectTrigger className="input-premium pl-11 h-12">
                      <SelectValue placeholder="Select your department" />
                    </SelectTrigger>
                    <SelectContent className="bg-card border-border shadow-premium-lg">
                      {LINES_OF_BUSINESS.map((lob) => (
                        <SelectItem
                          key={lob}
                          value={lob}
                          className="py-3 cursor-pointer hover:bg-muted/50 focus:bg-muted/50"
                        >
                          {lob}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <Button
          type="submit"
          disabled={isLoading}
          className="btn-gold w-full h-12 mt-2"
        >
          {isLoading ? (
            <span className="flex items-center gap-2">
              <span className="w-4 h-4 border-2 border-navy/30 border-t-navy rounded-full animate-spin" />
              Creating account...
            </span>
          ) : (
            <span className="flex items-center gap-2">
              Create Account
              <Sparkles className="w-4 h-4" />
            </span>
          )}
        </Button>
      </form>
    </Form>
  );
}
