# StockPilot — Cloud-Native Inventory & Expiry Management System
## Design Specification Document (`design.md`)
### Theme: Sahara — Warm Minimalism

---

### Executive Summary & System Philosophy
**StockPilot** is a mission-critical, cloud-native inventory and expiry management platform built with the **Sahara — Warm Minimalism** design philosophy. 

#### North Star: "Sun-Baked Simplicity"
Luxurious warmth meets disciplined minimalism. Golden sun-baked tones, editorial serif headings, and abundant whitespace transform an otherwise utilitarian warehouse tool into a high-end, calm, and curated executive experience.

The user experience unites two operational personas:
1. **High-Speed Counter & Kitchen Execution (Floor Staff):** Zero-friction modals, barcode entry, instant visual feedback, and automated First-Expired, First-Out (FEFO) routing.
2. **Executive Intelligence & Cloud Control (Store Managers):** Curated inventory valuation in INR (₹), automated Reorder Point (ROP) recalculations, and secure Amazon S3 compliance auditing.

---

## 1. Visual Foundation & Design Tokens

### 1.1 Color Palette

The entire palette is warm-shifted. Even grays and dark shades carry warm umber and sand undertones.

#### Light Mode (Warm Linen Canvas)
```css
:root {
  /* Brand Primary - Burnt Sienna */
  --brand-primary: #c2652a;
  --brand-primary-hover: #a85420;
  --brand-primary-light: #fbeee4;
  --brand-primary-glow: rgba(194, 101, 42, 0.14);

  /* Tertiary Accent - Dusty Rose */
  --accent-tertiary: #8c3c3c;
  --accent-tertiary-light: #faecec;

  /* Surfaces & Backgrounds */
  --bg-app: #faf5ee;                 /* Warm Linen Canvas */
  --bg-surface: #ffffff;             /* Crisp warm white card surface */
  --bg-surface-elevated: #fffcf7;    /* Elevated modals & popovers */
  --bg-surface-muted: #f3ece2;       /* Tinted warm beige for table headers */
  --bg-surface-hover: #f7f1e7;       /* Gentle hover warmth */
  --bg-sidebar: #26211c;             /* Espresso Noir warm dark sidebar */
  --bg-sidebar-hover: #352f28;
  --bg-sidebar-active: rgba(194, 101, 42, 0.22);

  /* Warm Borders & Dividers */
  --border-subtle: rgba(216, 208, 200, 0.65);
  --border-medium: #d8d0c8;
  --border-focus: #c2652a;

  /* Typography Colors */
  --text-primary: #29231e;           /* Deep espresso warm black */
  --text-secondary: #6e6256;         /* Muted warm earth */
  --text-tertiary: #a49789;          /* Sand gray */
  --text-inverse: #faf5ee;
  --text-sidebar: #c5bbb0;
  --text-sidebar-active: #ffffff;

  /* Semantic Health Tokens (Warm Shifted) */
  --status-success-bg: #edf6ee;
  --status-success-border: #c3e2c6;
  --status-success-text: #285e33;
  --status-success-dot: #3d8a4e;

  --status-warning-bg: #fdf5ea;
  --status-warning-border: #f4d9b3;
  --status-warning-text: #8c531b;
  --status-warning-dot: #c27d2a;

  --status-danger-bg: #faecec;
  --status-danger-border: #f1c7c7;
  --status-danger-text: #8c3c3c;     /* Dusty Rose / Crimson */
  --status-danger-dot: #b24a4a;

  --status-neutral-bg: #f3ece2;
  --status-neutral-border: #dcd4c8;
  --status-neutral-text: #6e6256;
}
```

#### Dark Mode (Sahara Obsidian & Warm Bronze)
Dark mode extends across the entire application **including the login screen**:
```css
[data-theme="dark"] {
  /* Dark Canvas & Surfaces */
  --bg-app: #15120f;                 /* Deep Warm Obsidian */
  --bg-surface: #1e1a16;             /* Warm Charcoal */
  --bg-surface-elevated: #28221c;    /* Elevated Cocoa */
  --bg-surface-muted: #241f1a;       /* Dark sand */
  --bg-surface-hover: #2d2621;
  --bg-sidebar: #0f0d0b;
  --bg-sidebar-hover: #1e1915;
  --bg-sidebar-active: rgba(217, 119, 59, 0.24);

  /* Warm Dark Borders */
  --border-subtle: rgba(140, 126, 115, 0.22);
  --border-medium: rgba(140, 126, 115, 0.4);
  --border-focus: #d9773b;

  /* Typography */
  --text-primary: #f7f2ea;           /* Warm Sand White */
  --text-secondary: #b8ac9f;         /* Desert Dune Gray */
  --text-tertiary: #7d7265;

  /* Accent Brightness Shift */
  --brand-primary: #d9773b;
  --brand-primary-hover: #e6884d;
  --brand-primary-light: rgba(217, 119, 59, 0.18);

  --status-success-bg: rgba(61, 138, 78, 0.16);
  --status-success-border: rgba(61, 138, 78, 0.32);
  --status-success-text: #72c486;

  --status-warning-bg: rgba(194, 125, 42, 0.16);
  --status-warning-border: rgba(194, 125, 42, 0.32);
  --status-warning-text: #e6a75a;

  --status-danger-bg: rgba(178, 74, 74, 0.16);
  --status-danger-border: rgba(178, 74, 74, 0.32);
  --status-danger-text: #e27d7d;
}
```

---

### 1.2 Typography Hierarchy

- **Editorial Serif Headlines:** `EB Garamond`, Georgia, serif — large sizes, tight tracking, literary elegance.
- **Body & Controls:** `Manrope`, -apple-system, sans-serif — geometric, crisp modern contrast to the serif.
- **Tabular Figures & Batch Identifiers:** `JetBrains Mono`, `tabular-nums` for monetary amounts in INR (`₹`), quantities, and dates.

| Element | Font Family | Size | Weight | Tracking | Usage |
| :--- | :--- | :--- | :--- | :--- | :--- |
| `hero-title` | EB Garamond | 36px (2.5rem) | 600 SemiBold | -0.02em | Login Hero & Dashboard Greeting |
| `h1` | EB Garamond | 26px (1.85rem) | 600 SemiBold | -0.015em | Top Screen Headers |
| `h2` | EB Garamond | 20px (1.4rem) | 600 SemiBold | -0.01em | Card Headers & Modal Titles |
| `body-base` | Manrope | 14px (0.875rem)| 400 Regular | 0.0em | Body copy, descriptions |
| `body-medium`| Manrope | 14px (0.875rem)| 600 SemiBold | 0.0em | Table cell primary text, buttons |
| `caption` | Manrope | 11px (0.7rem) | 600 SemiBold | +0.06em | Uppercase section badges, tags |
| `mono-code` | JetBrains Mono | 13px (0.8125rem)| 500 Medium | +0.02em | Batch IDs, Currency amounts in ₹ |

---

### 1.3 Elevation & Geometry

- **Ultra-Soft Shadows:** Barely visible warmth: `0 2px 16px rgba(58, 48, 42, 0.04)`, `0 8px 24px rgba(58, 48, 42, 0.06)`. Heavy elevation drop shadows are replaced by warm surface tinting.
- **Border Radii:**
  - Buttons & Inputs: `8px` (`--radius-md`)
  - Cards & Panels: `14px` (`--radius-lg`)
  - Status Badges: `9999px` (`--radius-pill`)
- **Whitespace Rules:**
  - Generous card padding: `28px to 32px`.
  - When in doubt, add more whitespace. Every view feels uncluttered and peaceful.

---

## 2. Component Design Specifications

### 2.1 Buttons
- **Primary:** Solid Burnt Sienna (`#c2652a`) background, warm ivory text, 8px radius, subtle hover lift.
- **Secondary:** Warm linen background, 1px warm border (`#d8d0c8`), dark espresso text.
- **Ghost:** Transparent background, underlined on hover, warm text color.

### 2.2 High-Density Curated Stat Cards
- Minimalist card with generous padding (24-28px).
- Small terracotta / dusty rose icon tint.
- Metric displayed in large EB Garamond figures with tabular currency in INR (`₹`).
- Contextual micro-subtext in muted Manrope.

### 2.3 Curated Data Tables with Sticky Headers
- Warm tinted sticky header (`var(--bg-surface-muted)`).
- Ultra-subtle warm borders between rows.
- **FEFO Shelf-Life Bar:** Warm sienna to olive-green visual progress indicator.
- Expiry badges using warm linen and dusty rose tints.

### 2.4 Modals & Requisitions
- Centered on warm backdrop blur (`rgba(38, 33, 28, 0.55)`).
- Card container with 14px radius, soft warm outline, and serene spacing.

---

## 3. Screen Layouts (with Dark Mode on Login)

### 3.1 `/login` (Split Screen with Universal Dark Mode Support)
- **Left Showcase Panel:** Warm terracotta-sienna gradient (or dark umber obsidian in dark mode) displaying an editorial quote, FEFO shelf-life explanation, and AWS security badges.
- **Right Form Container:** Soft warm linen card with EB Garamond headline *"Welcome to StockPilot"*, Manrope inputs with burnt sienna focus rings, and **1-Click Evaluation Switchers** (`Store Manager` vs `Floor Staff`).
- **Dark Mode Toggle:** Placed prominently in the upper right corner of the login screen so evaluators can switch themes before signing in.

### 3.2 `/` (Executive Dashboard)
- Editorial greeting: *"Good Morning, Campus Store #04"*.
- 6 curated stat tiles showcasing stock value, active batches, and 30-day expiry risk in INR.
- Recharts sales velocity chart rendered in warm sienna (`#c2652a`) bar fills with muted sand gridlines.
- Quick action dock: `[+ Inward Stock]`, `[⚡ FEFO Issue]`, `[Reorder Advisor]`, `[Export S3 CSV]`.

### 3.3 `/inventory` (Batch & FEFO Hub)
- Granular lot table with shelf-life visual progress bars.
- Interactive FEFO Modal featuring glowing burnt sienna pulse animation on the algorithmically chosen lot.

### 3.4 `/reorder` (Replenishment Advisor)
- Warm editorial mathematical formula callout box.
- Draft Purchase Order drawer formatted as a clean, luxurious supplier requisition voucher.

### 3.5 `/cloud` (AWS Architecture & Document Center)
- Warm sand topology nodes for Amazon EC2, RDS MySQL, S3 Vault, and SQS/SNS.
- Pre-Signed S3 download links with encrypted vault status.
