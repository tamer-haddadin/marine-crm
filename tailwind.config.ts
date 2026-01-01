import type { Config } from "tailwindcss";

export default {
  darkMode: ["class"],
  content: ["./client/index.html", "./client/src/**/*.{js,jsx,ts,tsx}"],
  theme: {
    extend: {
      /* Premium Font Families */
      fontFamily: {
        sans: ['Outfit', 'system-ui', '-apple-system', 'BlinkMacSystemFont', 'sans-serif'],
        serif: ['Playfair Display', 'Georgia', 'Times New Roman', 'serif'],
        mono: ['JetBrains Mono', 'SF Mono', 'Monaco', 'Consolas', 'monospace'],
        display: ['Playfair Display', 'Georgia', 'serif'],
      },
      borderRadius: {
        lg: "var(--radius)",
        md: "calc(var(--radius) - 2px)",
        sm: "calc(var(--radius) - 4px)",
        xl: "calc(var(--radius) + 4px)",
        "2xl": "calc(var(--radius) + 8px)",
      },
      colors: {
        background: "hsl(var(--background))",
        foreground: "hsl(var(--foreground))",
        card: {
          DEFAULT: "hsl(var(--card))",
          foreground: "hsl(var(--card-foreground))",
        },
        popover: {
          DEFAULT: "hsl(var(--popover))",
          foreground: "hsl(var(--popover-foreground))",
        },
        primary: {
          DEFAULT: "hsl(var(--primary))",
          foreground: "hsl(var(--primary-foreground))",
        },
        secondary: {
          DEFAULT: "hsl(var(--secondary))",
          foreground: "hsl(var(--secondary-foreground))",
        },
        muted: {
          DEFAULT: "hsl(var(--muted))",
          foreground: "hsl(var(--muted-foreground))",
        },
        accent: {
          DEFAULT: "hsl(var(--accent))",
          foreground: "hsl(var(--accent-foreground))",
        },
        destructive: {
          DEFAULT: "hsl(var(--destructive))",
          foreground: "hsl(var(--destructive-foreground))",
        },
        border: "hsl(var(--border))",
        input: "hsl(var(--input))",
        ring: "hsl(var(--ring))",
        chart: {
          "1": "hsl(var(--chart-1))",
          "2": "hsl(var(--chart-2))",
          "3": "hsl(var(--chart-3))",
          "4": "hsl(var(--chart-4))",
          "5": "hsl(var(--chart-5))",
        },
        sidebar: {
          DEFAULT: "hsl(var(--sidebar-background))",
          foreground: "hsl(var(--sidebar-foreground))",
          primary: "hsl(var(--sidebar-primary))",
          "primary-foreground": "hsl(var(--sidebar-primary-foreground))",
          accent: "hsl(var(--sidebar-accent))",
          "accent-foreground": "hsl(var(--sidebar-accent-foreground))",
          border: "hsl(var(--sidebar-border))",
          ring: "hsl(var(--sidebar-ring))",
        },
        /* Premium custom colors */
        gold: {
          DEFAULT: "hsl(43, 74%, 49%)",
          light: "hsl(43, 74%, 70%)",
          dark: "hsl(43, 74%, 35%)",
        },
        navy: {
          DEFAULT: "hsl(217, 91%, 18%)",
          light: "hsl(217, 91%, 35%)",
          dark: "hsl(217, 91%, 10%)",
        },
        emerald: {
          DEFAULT: "hsl(160, 84%, 39%)",
          light: "hsl(160, 84%, 55%)",
          dark: "hsl(160, 84%, 25%)",
        },
      },
      boxShadow: {
        /* Premium layered shadows */
        'premium-sm': '0 1px 2px hsl(222 47% 11% / 0.04), 0 2px 4px hsl(222 47% 11% / 0.04)',
        'premium': '0 1px 3px hsl(222 47% 11% / 0.04), 0 4px 12px hsl(222 47% 11% / 0.08)',
        'premium-lg': '0 4px 6px hsl(222 47% 11% / 0.05), 0 12px 24px hsl(222 47% 11% / 0.1)',
        'premium-xl': '0 8px 16px hsl(222 47% 11% / 0.08), 0 24px 48px hsl(222 47% 11% / 0.12)',
        'glow-gold': '0 0 20px hsl(43 74% 49% / 0.3)',
        'glow-navy': '0 0 20px hsl(217 91% 40% / 0.3)',
      },
      keyframes: {
        "accordion-down": {
          from: { height: "0" },
          to: { height: "var(--radix-accordion-content-height)" },
        },
        "accordion-up": {
          from: { height: "var(--radix-accordion-content-height)" },
          to: { height: "0" },
        },
        "fade-in": {
          from: { opacity: "0" },
          to: { opacity: "1" },
        },
        "fade-in-up": {
          from: { opacity: "0", transform: "translateY(20px)" },
          to: { opacity: "1", transform: "translateY(0)" },
        },
        "scale-in": {
          from: { opacity: "0", transform: "scale(0.95)" },
          to: { opacity: "1", transform: "scale(1)" },
        },
        "slide-in-right": {
          from: { opacity: "0", transform: "translateX(20px)" },
          to: { opacity: "1", transform: "translateX(0)" },
        },
        shimmer: {
          "0%": { backgroundPosition: "-200% 0" },
          "100%": { backgroundPosition: "200% 0" },
        },
        "glow-pulse": {
          "0%, 100%": { boxShadow: "0 0 20px hsl(43 74% 49% / 0.3)" },
          "50%": { boxShadow: "0 0 30px hsl(43 74% 49% / 0.5)" },
        },
      },
      animation: {
        "accordion-down": "accordion-down 0.2s ease-out",
        "accordion-up": "accordion-up 0.2s ease-out",
        "fade-in": "fade-in 0.6s cubic-bezier(0.22, 1, 0.36, 1) forwards",
        "fade-in-up": "fade-in-up 0.6s cubic-bezier(0.22, 1, 0.36, 1) forwards",
        "scale-in": "scale-in 0.5s cubic-bezier(0.22, 1, 0.36, 1) forwards",
        "slide-in-right": "slide-in-right 0.5s cubic-bezier(0.22, 1, 0.36, 1) forwards",
        shimmer: "shimmer 2s ease-in-out infinite",
        "glow-pulse": "glow-pulse 3s ease-in-out infinite",
      },
      backgroundImage: {
        'gradient-gold': 'linear-gradient(135deg, hsl(43, 74%, 49%) 0%, hsl(43, 74%, 65%) 100%)',
        'gradient-navy': 'linear-gradient(135deg, hsl(217, 91%, 18%) 0%, hsl(217, 91%, 28%) 100%)',
        'gradient-premium': 'linear-gradient(135deg, hsl(222, 47%, 11%) 0%, hsl(217, 91%, 35%) 50%, hsl(43, 74%, 49%) 100%)',
      },
    },
  },
  plugins: [require("tailwindcss-animate"), require("@tailwindcss/typography")],
} satisfies Config;
