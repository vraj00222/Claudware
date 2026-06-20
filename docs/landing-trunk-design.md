---
version: alpha
name: Trunk Minimal CI
description: A stark, high-contrast landing-page system with editorial typography, soft pill controls, and almost no decorative depth.
colors:
  primary: "#08090B"
  secondary: "#232323"
  tertiary: "#E2E8F0"
  neutral: "#FFFFFF"
  surface: "#FFFFFF"
  on-surface: "#000000"
  error: "#D92D20"
  accent: "#00A44A"
  accent-weak: "#5ACB82"
  muted: "#F5F5F5"
typography:
  headline-display:
    fontFamily: Neue
    fontSize: 37px
    fontWeight: 700
    lineHeight: 44px
    letterSpacing: -1px
  headline-lg:
    fontFamily: Neue
    fontSize: 30px
    fontWeight: 500
    lineHeight: 30px
    letterSpacing: 0px
  headline-md:
    fontFamily: Neue
    fontSize: 24px
    fontWeight: 500
    lineHeight: 30px
    letterSpacing: 0px
  headline-sm:
    fontFamily: Neue
    fontSize: 18px
    fontWeight: 500
    lineHeight: 22px
    letterSpacing: 0px
  body-lg:
    fontFamily: Neue
    fontSize: 18px
    fontWeight: 300
    lineHeight: 28px
    letterSpacing: 0px
  body-md:
    fontFamily: Neue
    fontSize: 16px
    fontWeight: 300
    lineHeight: 24px
    letterSpacing: 0px
  body-sm:
    fontFamily: Neue
    fontSize: 14px
    fontWeight: 400
    lineHeight: 20px
    letterSpacing: 0px
  label-lg:
    fontFamily: Neue
    fontSize: 16px
    fontWeight: 500
    lineHeight: 20px
    letterSpacing: 0px
  label-md:
    fontFamily: Neue
    fontSize: 14px
    fontWeight: 500
    lineHeight: 18px
    letterSpacing: 0px
  label-sm:
    fontFamily: Neue
    fontSize: 12px
    fontWeight: 500
    lineHeight: 16px
    letterSpacing: 0px
  caption:
    fontFamily: Neue
    fontSize: 14px
    fontWeight: 400
    lineHeight: 20px
    letterSpacing: 0px
rounded:
  none: 0px
  sm: 4px
  md: 8px
  lg: 12px
  xl: 16px
  full: 9999px
spacing:
  xs: 6px
  sm: 16px
  md: 24px
  lg: 40px
  xl: 164px
components:
  button-primary:
    backgroundColor: "{colors.primary}"
    textColor: "{colors.neutral}"
    typography: "{typography.label-md}"
    rounded: "{rounded.lg}"
    padding: "12px 19px"
    height: "38px"
  button-secondary:
    backgroundColor: "{colors.neutral}"
    textColor: "{colors.primary}"
    typography: "{typography.label-md}"
    rounded: "{rounded.lg}"
    padding: "12px 19px"
    height: "38px"
  button-tertiary:
    backgroundColor: "transparent"
    textColor: "{colors.primary}"
    typography: "{typography.label-md}"
    rounded: "{rounded.none}"
    padding: "0px"
  card:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.on-surface}"
    rounded: "12px"
    padding: "16px"
  input:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.on-surface}"
    typography: "{typography.body-sm}"
    rounded: "{rounded.lg}"
    padding: "12px 16px"
  chip:
    backgroundColor: "{colors.muted}"
    textColor: "{colors.on-surface}"
    typography: "{typography.label-sm}"
    rounded: "{rounded.full}"
    padding: "6px 12px"
---

# Trunk Minimal CI

## Overview
This system feels crisp, restrained, and highly product-focused, with a strong editorial voice and a minimal color palette. It is built for technical buyers who want confidence, speed, and clarity rather than visual ornament. The overall tone is professional and slightly dramatic, using a large hero message, soft pill-shaped controls, and a monochrome base interrupted by a single vivid green accent.

## Colors
- **Primary (#08090B):** The core ink-black used for main buttons, strong text, and high-contrast UI elements. It gives the brand its serious, dependable tone.
- **Secondary (#232323):** A deep charcoal used for borders, dividers, and structural definition when pure black would feel too severe.
- **Tertiary (#E2E8F0):** A pale cool neutral that suits low-emphasis borders and understated UI chrome.
- **Neutral (#FFFFFF):** The main light canvas for the page, cards, and secondary buttons.
- **Surface (#FFFFFF):** Same as neutral, reinforcing the flat, bright product surface language.
- **On-surface (#000000):** The default content color for readable text on white surfaces.
- **Accent (#00A44A):** The signature green used sparingly for brand energy and the “keep CI green” concept.
- **Accent-weak (#5ACB82):** A softer green for secondary highlight moments or tonal variation in illustrations and states.
- **Muted (#F5F5F5):** A quiet background fill for subtle chips, tags, or low-contrast UI containers.
- **Error (#D92D20):** Reserved for destructive states and validation messaging; it should stay rare in this otherwise calm palette.

## Typography
The site uses Neue as the primary voice, with the fallback stack supporting a clean grotesk sans-serif feel. Headlines are bold to medium-weight and tightly tracked, especially the display headline which uses a -1px letter spacing for a compact, confident hero treatment. Body copy is lighter at 300 weight, creating a polished contrast between assertive headings and airy supporting text. Labels and buttons are medium-weight, with no visible uppercase or wide tracking convention; the system relies on size and weight rather than all-caps styling to create emphasis.

## Layout
The layout is centered and maximalist in hero scale but otherwise simple, using a fixed-width content frame with generous outer whitespace. Spacing follows a sparse rhythm: small internal gaps for controls, medium gaps between text and actions, and very large vertical breathing room in the hero composition. The main CTA cluster sits close together, while supporting proof content is pushed lower to create a dramatic top-heavy landing page hierarchy. Use the larger spacing steps for section separation and the smaller steps for button groups, nav items, and inline metadata.

## Elevation & Depth
The design is intentionally flat. Instead of shadows or layered cards, hierarchy comes from contrast, scale, and a few thin borders. Depth is mostly implied through the illustration and the dark-to-light tonal transition in the background, not through component elevation. Avoid adding heavy shadow systems; subtle borders and strong contrast are the preferred way to separate surfaces.

## Shapes
The shape language is soft and approachable, led by medium-large radii on buttons and cards. Interactive elements lean pill-like, especially the primary and secondary buttons, which read as rounded capsules rather than sharp rectangles. Cards are slightly less rounded than buttons but still soft enough to feel modern and friendly. Overall, the geometry is gentle and polished, not angular or mechanical.

## Components
Buttons are the most visible UI element and should stay simple, high-contrast, and compact. Use `button-primary` for the black filled CTA with white text, and `button-secondary` for the white outlined-light alternative with black text. Both should use the same 12px by 19px padding and 38px height feel, with medium-weight labels and no shadow. `button-tertiary` should remain text-only and transparent for navigation or secondary inline actions.

Cards should be white, bordered, and minimally padded, as reflected in `card`. Keep card borders thin and dark enough to define the container without creating heavy visual weight. Inputs should follow the same rounded, clean language as buttons, with white surfaces and restrained padding. Chips should be small, pill-shaped, and muted, with quiet contrast rather than attention-seeking color.

Nav items, links, and supporting text should stay understated and black on white unless they are primary actions. If icons or dropdown indicators are used, keep them lightweight and aligned to the text baseline. Any state treatment should be subtle: slight color shifts or border emphasis are preferred over shadow, motion, or filled glows.

## Do's and Don'ts
- Do keep the palette mostly monochrome and use green only as a deliberate brand accent.
- Do use Neue consistently for both headlines and UI text to preserve the editorial tone.
- Do prefer bold scale contrast over shadows to establish hierarchy.
- Do keep buttons compact, rounded, and visually calm.
- Don't introduce colorful gradients, glassmorphism, or decorative depth.
- Don't use sharp corners for primary interactive elements.
- Don't over-space small UI controls; reserve the largest spacing only for major section breaks.
- Don't switch to uppercase-heavy label styling or add aggressive tracking.