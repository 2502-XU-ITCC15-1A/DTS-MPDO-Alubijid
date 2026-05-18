export default {
  content: ["./index.html", "./src/**/*.{js,ts,jsx,tsx}"],

  theme: {
    extend: {
      fontFamily: {
        sans: ['"Plus Jakarta Sans Variable"', 'sans-serif'],
      },

      colors: {
        accent: "#16a34a",

        background: "var(--background)",
        foreground: "var(--foreground)",

        card: "var(--card)",
        border: "var(--border)",

        muted: "var(--muted)",
        "muted-foreground": "var(--muted-foreground)",

        primary: "var(--primary)",
        "primary-foreground": "var(--primary-foreground)",

        sidebar: "var(--sidebar)",
        "sidebar-foreground": "var(--sidebar-foreground)",

        "status-ongoing": "var(--status-ongoing)",
        "status-completed": "var(--status-completed)",
        "status-delayed": "var(--status-delayed)",
        "status-utilization": "var(--status-utilization)",

        destructive: "var(--destructive)",
        "destructive-foreground": "var(--destructive-foreground)",

        success: "var(--status-completed)",   
        warning: "oklch(0.75 0.18 70)",      
        info: "var(--primary)",              


        "severity-critical": "var(--destructive)",
        "severity-high": "oklch(0.75 0.18 70)",  
        "severity-medium": "var(--primary)",
        "severity-low": "oklch(0.7 0.02 250)",
      },
    },
  },

  plugins: [],
};