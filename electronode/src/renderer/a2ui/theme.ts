/**
 * Hera A2UI Theme
 *
 * Custom theme for @a2ui/lit renderer with Hera brand colors.
 * Uses @lit/context to inject theme into A2UI components.
 */

import { createContext } from "@lit/context";

/**
 * Hera Brand Colors
 */
const colors = {
  // Primary
  accent: "#e91e8c", // Hera ruby pink
  accentHover: "#ff2ba0",
  accentLight: "rgba(233, 30, 140, 0.1)",

  // Background
  background: "#0a0e14", // Deep dark blue-black
  backgroundElevated: "#14181f",
  backgroundCard: "rgba(255, 255, 255, 0.04)",

  // Text
  textPrimary: "#e6eaf0",
  textSecondary: "#8892a6",
  textMuted: "#5c6475",

  // Borders
  border: "rgba(255, 255, 255, 0.08)",
  borderHover: "rgba(233, 30, 140, 0.3)",

  // Status
  success: "#22c55e",
  error: "#ef4444",
  warning: "#f59e0b",
};

/**
 * Empty class helper (A2UI theme structure)
 */
const emptyClasses = () => ({});

/**
 * Text hint styles helper
 */
const textHintStyles = () => ({
  h1: {},
  h2: {},
  h3: {},
  h4: {},
  h5: {},
  body: {},
  caption: {},
});

/**
 * Hera A2UI Theme
 *
 * Based on A2UI v0.8 theme structure, customized for Hera branding.
 */
export const heraTheme = {
  components: {
    AudioPlayer: emptyClasses(),
    Button: emptyClasses(),
    Card: emptyClasses(),
    Column: emptyClasses(),
    CheckBox: {
      container: emptyClasses(),
      element: emptyClasses(),
      label: emptyClasses(),
    },
    DateTimeInput: {
      container: emptyClasses(),
      element: emptyClasses(),
      label: emptyClasses(),
    },
    Divider: emptyClasses(),
    Image: {
      all: emptyClasses(),
      icon: emptyClasses(),
      avatar: emptyClasses(),
      smallFeature: emptyClasses(),
      mediumFeature: emptyClasses(),
      largeFeature: emptyClasses(),
      header: emptyClasses(),
    },
    Icon: emptyClasses(),
    List: emptyClasses(),
    Modal: {
      backdrop: emptyClasses(),
      element: emptyClasses(),
    },
    MultipleChoice: {
      container: emptyClasses(),
      element: emptyClasses(),
      label: emptyClasses(),
    },
    Row: emptyClasses(),
    Slider: {
      container: emptyClasses(),
      element: emptyClasses(),
      label: emptyClasses(),
    },
    Tabs: {
      container: emptyClasses(),
      element: emptyClasses(),
      controls: {
        all: emptyClasses(),
        selected: emptyClasses(),
      },
    },
    Text: {
      all: emptyClasses(),
      h1: emptyClasses(),
      h2: emptyClasses(),
      h3: emptyClasses(),
      h4: emptyClasses(),
      h5: emptyClasses(),
      caption: emptyClasses(),
      body: emptyClasses(),
    },
    TextField: {
      container: emptyClasses(),
      element: emptyClasses(),
      label: emptyClasses(),
    },
    Video: emptyClasses(),
  },
  elements: {
    a: emptyClasses(),
    audio: emptyClasses(),
    body: emptyClasses(),
    button: emptyClasses(),
    h1: emptyClasses(),
    h2: emptyClasses(),
    h3: emptyClasses(),
    h4: emptyClasses(),
    h5: emptyClasses(),
    iframe: emptyClasses(),
    input: emptyClasses(),
    p: emptyClasses(),
    pre: emptyClasses(),
    textarea: emptyClasses(),
    video: emptyClasses(),
  },
  markdown: {
    p: [],
    h1: [],
    h2: [],
    h3: [],
    h4: [],
    h5: [],
    ul: [],
    ol: [],
    li: [],
    a: [],
    strong: [],
    em: [],
  },
  additionalStyles: {
    Card: {
      background: `linear-gradient(135deg, ${colors.backgroundCard}, rgba(255, 255, 255, 0.02))`,
      border: `1px solid ${colors.border}`,
      borderRadius: "12px",
      padding: "16px",
      boxShadow: "0 4px 16px rgba(0, 0, 0, 0.3)",
    },
    Modal: {
      background: "rgba(10, 14, 20, 0.96)",
      border: `1px solid ${colors.border}`,
      borderRadius: "16px",
      padding: "20px",
      boxShadow: "0 20px 60px rgba(0, 0, 0, 0.6)",
      width: "min(480px, calc(100vw - 48px))",
      backdropFilter: "blur(12px)",
    },
    Column: {
      gap: "12px",
    },
    Row: {
      gap: "12px",
      alignItems: "center",
    },
    Divider: {
      opacity: "0.15",
      background: colors.border,
    },
    Button: {
      background: `linear-gradient(135deg, ${colors.accent}, #c71873)`,
      border: "0",
      borderRadius: "10px",
      padding: "10px 16px",
      color: "#ffffff",
      fontWeight: "600",
      fontSize: "14px",
      cursor: "pointer",
      boxShadow: `0 4px 12px rgba(233, 30, 140, 0.25)`,
      transition: "all 0.15s ease",
    },
    Text: {
      ...textHintStyles(),
      h1: {
        fontSize: "24px",
        fontWeight: "700",
        margin: "0 0 12px 0",
        color: colors.textPrimary,
        lineHeight: "1.3",
      },
      h2: {
        fontSize: "20px",
        fontWeight: "700",
        margin: "0 0 10px 0",
        color: colors.textPrimary,
        lineHeight: "1.3",
      },
      h3: {
        fontSize: "17px",
        fontWeight: "600",
        margin: "0 0 8px 0",
        color: colors.textPrimary,
        lineHeight: "1.4",
      },
      h4: {
        fontSize: "15px",
        fontWeight: "600",
        margin: "0 0 6px 0",
        color: colors.textPrimary,
        lineHeight: "1.4",
      },
      body: {
        fontSize: "14px",
        lineHeight: "1.5",
        color: colors.textPrimary,
        margin: "0",
      },
      caption: {
        fontSize: "12px",
        opacity: "0.7",
        color: colors.textSecondary,
        margin: "0",
      },
    },
    TextField: {
      display: "grid",
      gap: "8px",
    },
    Image: {
      borderRadius: "10px",
    },
  },
};

/**
 * Theme context - MUST use "A2UITheme" to match @a2ui/lit internal context
 */
export const themeContext = createContext<typeof heraTheme>("A2UITheme");

/**
 * CSS custom properties for global theming
 */
export const heraCSSVars = `
  --background: ${colors.background};
  --background-elevated: ${colors.backgroundElevated};
  --background-card: ${colors.backgroundCard};
  --accent: ${colors.accent};
  --accent-hover: ${colors.accentHover};
  --accent-light: ${colors.accentLight};
  --text-primary: ${colors.textPrimary};
  --text-secondary: ${colors.textSecondary};
  --text-muted: ${colors.textMuted};
  --border: ${colors.border};
  --border-hover: ${colors.borderHover};
  --success: ${colors.success};
  --error: ${colors.error};
  --warning: ${colors.warning};
`;
