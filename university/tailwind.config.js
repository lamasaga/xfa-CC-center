/** @type {import('tailwindcss').Config} */
module.exports = {
  darkMode: ["class"],
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        'bg-deep': '#FAF7F2',
        'bg-card': '#FFFFFF',
        'bg-surface': '#F5F0E8',
        'bg-elevated': '#F0EBE3',
        'accent-gold': '#C8A45C',
        'accent-crimson': '#8B2332',
        'accent-sage': '#4A7C6F',
        'text-primary': '#2C2420',
        'text-secondary': '#6B6560',
        'text-tertiary': '#9A9590',
        'border-subtle': '#E8E2D9',
        'border-active': '#C8A45C',
        region: {
          us: '#3B6EA5',
          uk: '#8B2332',
          canada: '#C2553A',
          australia: '#4A7C6F',
          europe: '#6B4C8A',
          'hong-kong': '#C8553D',
          singapore: '#D4943A',
          art: '#C8A45C',
        },
        border: "hsl(var(--border))",
        input: "hsl(var(--input))",
        ring: "hsl(var(--ring))",
        background: "hsl(var(--background))",
        foreground: "hsl(var(--foreground))",
        primary: {
          DEFAULT: "hsl(var(--primary))",
          foreground: "hsl(var(--primary-foreground))",
        },
        secondary: {
          DEFAULT: "hsl(var(--secondary))",
          foreground: "hsl(var(--secondary-foreground))",
        },
        destructive: {
          DEFAULT: "hsl(var(--destructive) / <alpha-value>)",
          foreground: "hsl(var(--destructive-foreground) / <alpha-value>)",
        },
        muted: {
          DEFAULT: "hsl(var(--muted))",
          foreground: "hsl(var(--muted-foreground))",
        },
        accent: {
          DEFAULT: "hsl(var(--accent))",
          foreground: "hsl(var(--accent-foreground))",
        },
        popover: {
          DEFAULT: "hsl(var(--popover))",
          foreground: "hsl(var(--popover-foreground))",
        },
        card: {
          DEFAULT: "hsl(var(--card))",
          foreground: "hsl(var(--card-foreground))",
        },
      },
      fontFamily: {
        'space': ['"Space Grotesk"', 'sans-serif'],
        'noto': ['"Noto Sans SC"', 'sans-serif'],
        'inter': ['Inter', 'sans-serif'],
        'mono': ['"JetBrains Mono"', 'monospace'],
        'serif': ['"Instrument Serif"', 'serif'],
      },
      borderRadius: {
        xl: "calc(var(--radius) + 4px)",
        lg: "var(--radius)",
        md: "calc(var(--radius) - 2px)",
        sm: "calc(var(--radius) - 4px)",
        xs: "calc(var(--radius) - 6px)",
      },
      boxShadow: {
        xs: "0 1px 2px 0 rgb(0 0 0 / 0.05)",
        'elegant': '0 4px 20px rgba(44, 36, 32, 0.06), 0 1px 3px rgba(44, 36, 32, 0.04)',
        'elegant-lg': '0 12px 40px rgba(44, 36, 32, 0.08), 0 4px 12px rgba(44, 36, 32, 0.05)',
        'elegant-hover': '0 20px 60px rgba(44, 36, 32, 0.12), 0 8px 20px rgba(44, 36, 32, 0.06)',
        'card': '0 2px 8px rgba(44, 36, 32, 0.04), 0 0 1px rgba(44, 36, 32, 0.08)',
        'card-hover': '0 8px 24px rgba(44, 36, 32, 0.08), 0 2px 6px rgba(44, 36, 32, 0.05)',
      },
      transitionTimingFunction: {
        'elegant': 'cubic-bezier(0.16, 1, 0.3, 1)',
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
        "caret-blink": {
          "0%,70%,100%": { opacity: "1" },
          "20%,50%": { opacity: "0" },
        },
      },
      animation: {
        "accordion-down": "accordion-down 0.2s ease-out",
        "accordion-up": "accordion-up 0.2s ease-out",
        "caret-blink": "caret-blink 1.25s ease-out infinite",
      },
    },
  },
  plugins: [require("tailwindcss-animate")],
}
