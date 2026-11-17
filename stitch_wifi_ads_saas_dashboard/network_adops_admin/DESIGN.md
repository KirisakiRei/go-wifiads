---
name: Network AdOps Admin
colors:
  surface: '#f8f9ff'
  surface-dim: '#cbdbf5'
  surface-bright: '#f8f9ff'
  surface-container-lowest: '#ffffff'
  surface-container-low: '#eff4ff'
  surface-container: '#e5eeff'
  surface-container-high: '#dce9ff'
  surface-container-highest: '#d3e4fe'
  on-surface: '#0b1c30'
  on-surface-variant: '#434655'
  inverse-surface: '#213145'
  inverse-on-surface: '#eaf1ff'
  outline: '#747686'
  outline-variant: '#c4c5d7'
  surface-tint: '#2151da'
  primary: '#0037b0'
  on-primary: '#ffffff'
  primary-container: '#1d4ed8'
  on-primary-container: '#cad3ff'
  inverse-primary: '#b7c4ff'
  secondary: '#00668a'
  on-secondary: '#ffffff'
  secondary-container: '#40c2fd'
  on-secondary-container: '#004d6a'
  tertiary: '#3d445a'
  on-tertiary: '#ffffff'
  tertiary-container: '#545c72'
  on-tertiary-container: '#cdd5ef'
  error: '#ba1a1a'
  on-error: '#ffffff'
  error-container: '#ffdad6'
  on-error-container: '#93000a'
  primary-fixed: '#dce1ff'
  primary-fixed-dim: '#b7c4ff'
  on-primary-fixed: '#001551'
  on-primary-fixed-variant: '#0039b5'
  secondary-fixed: '#c4e7ff'
  secondary-fixed-dim: '#7bd0ff'
  on-secondary-fixed: '#001e2c'
  on-secondary-fixed-variant: '#004c69'
  tertiary-fixed: '#dae2fd'
  tertiary-fixed-dim: '#bec6e0'
  on-tertiary-fixed: '#131b2e'
  on-tertiary-fixed-variant: '#3f465c'
  background: '#f8f9ff'
  on-background: '#0b1c30'
  surface-variant: '#d3e4fe'
typography:
  headline-xl:
    fontFamily: Plus Jakarta Sans
    fontSize: 32px
    fontWeight: '700'
    lineHeight: 40px
    letterSpacing: -0.02em
  headline-lg:
    fontFamily: Plus Jakarta Sans
    fontSize: 24px
    fontWeight: '600'
    lineHeight: 32px
    letterSpacing: -0.015em
  headline-md:
    fontFamily: Plus Jakarta Sans
    fontSize: 20px
    fontWeight: '600'
    lineHeight: 28px
    letterSpacing: -0.01em
  title-sm:
    fontFamily: Plus Jakarta Sans
    fontSize: 16px
    fontWeight: '600'
    lineHeight: 24px
    letterSpacing: 0em
  body-lg:
    fontFamily: Plus Jakarta Sans
    fontSize: 16px
    fontWeight: '400'
    lineHeight: 24px
    letterSpacing: 0em
  body-md:
    fontFamily: Plus Jakarta Sans
    fontSize: 14px
    fontWeight: '400'
    lineHeight: 20px
    letterSpacing: 0em
  body-sm:
    fontFamily: Plus Jakarta Sans
    fontSize: 12px
    fontWeight: '400'
    lineHeight: 16px
    letterSpacing: 0.01em
  label-md:
    fontFamily: Plus Jakarta Sans
    fontSize: 13px
    fontWeight: '600'
    lineHeight: 18px
    letterSpacing: 0.01em
  label-sm:
    fontFamily: Plus Jakarta Sans
    fontSize: 11px
    fontWeight: '600'
    lineHeight: 14px
    letterSpacing: 0.04em
  telemetry-metric:
    fontFamily: Plus Jakarta Sans
    fontSize: 28px
    fontWeight: '700'
    lineHeight: 34px
    letterSpacing: -0.02em
  telemetry-code:
    fontFamily: Plus Jakarta Sans
    fontSize: 12px
    fontWeight: '500'
    lineHeight: 16px
    letterSpacing: 0.02em
rounded:
  sm: 0.25rem
  DEFAULT: 0.5rem
  md: 0.75rem
  lg: 1rem
  xl: 1.5rem
  full: 9999px
spacing:
  gutter: 1.5rem
  gutter-sm: 1rem
  margin: 2rem
  margin-sm: 1rem
  space-xs: 0.25rem
  space-sm: 0.5rem
  space-md: 1rem
  space-lg: 1.5rem
  space-xl: 2rem
---

## Brand & Style
The design system targets enterprise network engineers, venue operators, and marketing managers who manage captive portal ad monetization across distributed MikroTik router fleets. The visual atmosphere balances infrastructural rigor with modern marketing SaaS clarity: disciplined, precise, dependable, yet light and friendly. 

The aesthetic is Modern Flat. It departs from glossy or heavy neo-brutalist tech tropes, utilizing crisp white containers, cool slate architectural planes, subtle structural dividing lines, and selective soft rounded accents. Visual noise is minimized to prioritize live telemetry, connection throughput, campaign conversion rates, and hardware health metrics.

## Colors
The palette leverages a deep cobalt core supported by high-legibility cool neutrals and luminous technical accents:

- **Primary (`#1D4ED8`, hover `#2563EB`):** Used for primary interactive actions, high-priority navigation states, and primary KPI callouts.
- **Secondary (`#38BDF8`, tint `#E0F2FE`):** Soft sky accents for active connection waves, data visualization paths, dynamic badge fills, and contextual router signals.
- **Neutrals & Surfaces:**
  - Base Canvas: `#F8FAFC` (Cool Slate Canvas)
  - Card & Container Surface: `#FFFFFF` (Crisp Pure White)
  - Secondary Inset Panels & Table Headers: `#F1F5F9` (Muted Slate Surface)
  - Borders & Dividers: `#E2E8F0` (Structural Line)
- **Typography Scale:**
  - Primary Headlines & Key Metrics: `#0F172A` (Slate 900)
  - Body Text & Input Value: `#1E293B` (Slate 800)
  - Subdued Text, Labels & Unit Markers: `#475569` (Slate 600)
  - Muted Placeholders: `#94A3B8` (Slate 400)
- **Status Semantics:**
  - Hardware Active / Synced: `#10B981` (Emerald 500), background `#ECFDF5`
  - Warning / Traffic Congestion: `#F59E0B` (Amber 500), background `#FFFBEB`
  - Offline / Router Timeout: `#EF4444` (Rose 500), background `#FEF2F2`

## Typography
Plus Jakarta Sans serves as the single typographic family across all interfaces, utilizing its clear geometric structures, open apertures, and subtle contemporary curves to maintain crisp legibility across dense data tables and telemetry readouts.

- Numerical telemetry points, bandwidth figures (`Mbps`, `GB`), and IP/MAC addresses are set with tabular figures (`tnum`) to maintain vertical alignment in data grids.
- Section headers and card metrics balance confident medium-to-bold weights with tight negative letter tracking to prevent visual fragmentation.
- Form field labels and column definitions utilize uppercase or small semi-bold styling (`label-sm`, `label-md`) in `#475569` to establish quick scannability.

## Layout & Spacing
The layout model operates on an 8pt baseline rhythm inside a flexible 12-column administrative grid system. 

- **Structure:** Desktop interfaces feature a fixed 260px left sidebar, a 64px structural app bar, and a fluid main dashboard panel bound within a max width of 1600px to ensure data density remains manageable on ultrawide monitors.
- **Breakpoints:**
  - `Desktop (>= 1280px)`: 12 columns, 24px gutter, 32px canvas margins.
  - `Tablet (768px - 1279px)`: 8 columns, 16px gutter, 24px canvas margins. The navigation collapses into an icon rail or off-canvas drawer.
  - `Mobile (< 768px)`: 4 columns, 16px gutter, 16px canvas margins. Data tables switch to stacked metric cards.
- **Whitespace Cadence:** High density in operational tables (8px–12px row height padding) paired with generous white breathing room (24px–32px) around dashboard widgets to prevent technical fatigue.

## Elevation & Depth
Depth is achieved primarily through a flat architectural layering strategy rather than heavy shadows:

- **Level 0 (Canvas):** `#F8FAFC` base surface for system background.
- **Level 1 (Cards, Tables, Structural Insets):** `#FFFFFF` surfaces paired with a crisp 1px solid border (`#E2E8F0`). Flat boundaries replace dramatic dropped shadows.
- **Ambient Shadow Token (Elevation Accent):** Where elevation is functionally required (dropdown menus, popovers, active modals), use an ultra-diffused, cool slate tint:
  - `box-shadow: 0 4px 20px -2px rgba(15, 23, 42, 0.05), 0 2px 6px -1px rgba(15, 23, 42, 0.03)`
- **Dividers & Delimiters:** Use smooth horizontal dividers (`1px solid #E2E8F0`). Optional organic wave dividers can separate hero metrics from tabular reports using an SVG path filled with `#F1F5F9`.

## Shapes
The shape strategy balances technical precision with organic, friendly contours:

- **Primary Cards & Containers:** Standardized with an outer radius of `16px` (`rounded-lg`), creating an approachable dashboard frame without sacrificing interior rectangular data density.
- **Buttons, Form Inputs & Search Bars:** Shaped at `10px` to `12px` (`rounded-md` to `rounded-lg`) for a soft, tactile touchpoint.
- **Status Pills & Metric Badges:** Pill-shaped (`rounded-full`, 9999px) to distinctly separate inline tags, router statuses, and telemetry chips from squared tabular data.
- **Curved Dividing Accents:** Section transitions occasionally integrate subtle 4px–8px curved wave separators to reinforce the WiFi signal wave metaphor without introducing non-functional skeuomorphism.

## Components

### Buttons
- **Primary:** Background `#1D4ED8`, text `#FFFFFF`, border-radius 12px, font-weight 600. Hover: `#2563EB`. Active: `#1E40AF`.
- **Secondary:** Background `#E0F2FE`, text `#0369A1`, border 1px solid transparent. Hover: `#BAE6FD`.
- **Outline / Flat:** Background `#FFFFFF`, text `#1E293B`, border 1px solid `#E2E8F0`. Hover: `#F8FAFC` border `#CBD5E1`.

### Data Cards & Telemetry Widgets
- Surface `#FFFFFF`, border `1px solid #E2E8F0`, corner radius `16px`, interior padding `24px`.
- Metric layout: Subtle uppercase label (`#475569`, 11px), prominent metric (`#0F172A`, 28px bold), followed by inline trend pill (e.g., `+12.4%` in Emerald or Sky tint).

### Router Health & Status Indicators
- **MikroTik Router Row / Chip:** Pill container with an active dot indicator:
  - Connected: `#10B981` dot with `#ECFDF5` pill background, text `#065F46`.
  - Disconnected / Fault: `#EF4444` dot with `#FEF2F2` pill background, text `#991B1B`.
  - Standby / Low Signal: `#F59E0B` dot with `#FFFBEB` pill background, text `#92400E`.
- Include router identity badges displaying RouterOS version and uptime in `telemetry-code` typography.

### Data Tables
- Header row: `#F8FAFC`, text `#475569`, font size 12px uppercase, tracking 0.04em, bottom border `1px solid #E2E8F0`.
- Data rows: `#FFFFFF`, hover row state `#F8FAFC`, height 52px, cell border bottom `1px solid #F1F5F9`.
- Column alignments: Left for client/campaign names, center for router status pills, right for impressions, CTR, and bandwidth counters.

### Form Inputs & Select Controls
- Background `#FFFFFF`, border `1px solid #CBD5E1`, corner radius `10px`, padding `10px 14px`.
- Focus state: Border `1.5px solid #1D4ED8`, subtle ring `0 0 0 3px rgba(56, 189, 248, 0.25)`.
- Label placed outside top: 13px weight 600 `#1E293B`.

### Checkboxes & Radios
- Box size 18px x 18px, border-radius 6px (checkbox) or circular (radio).
- Default: `#FFFFFF`, border `1.5px solid #CBD5E1`.
- Checked: `#1D4ED8` background with crisp white icon checkmark.