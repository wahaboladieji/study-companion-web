---
name: design-system-component
description: Use when creating or substantially changing a reusable UI component or screen, including buttons, inputs, Course cards, file rows, dialogs, upload states, Study Notes, Flashcards, Chat interfaces, navigation, loading states, error states, focus states, responsive layouts, or Tailwind token mappings. Trigger words include component, screen, UI, design system, Tailwind, CSS variables, semantic color, typography, spacing, responsive, accessibility, and WCAG.
---

# Design System Component

This skill teaches the ordered method for building a compliant interface component.

The governing laws are in:

- `.agents/rules/design-system-rule.md`
- `.agents/rules/coding-standards.md`
- `.agents/rules/security.md`
- `AGENTS.md`

## Procedure

1. Identify the component's job.
   - State what the user must see or do.
   - Identify whether it is shared or feature-specific.
   - Do not add new product behavior.

2. List every required state.
   - Default.
   - Hover.
   - Focus.
   - Active or pressed.
   - Disabled.
   - Loading.
   - Error where applicable.
   - Empty or processing states where required by the PRD.

3. Select semantic color roles.
   - Use `--color-roles-*` variables.
   - Pair each background with its matching `on-*` foreground.
   - Never use `--primitive-colors-*` in UI code.
   - Do not invent success, warning, or information colors.

4. Select typography roles.
   - Use DM Sans.
   - Choose Display, Headline, Title, Body, or Label based on content meaning.
   - Apply font size, weight, line height, and letter spacing together.

5. Select spacing tokens.
   - Use the approved spacing scale.
   - Convert unitless variables through the central mapping.
   - Do not add arbitrary Tailwind spacing values.

6. Select elevation and boundaries.
   - Use approved surface and outline roles.
   - Use only approved soft, medium, or hard shadow tokens.
   - Do not add arbitrary shadows.

7. Build the semantic HTML structure.
   - Use the correct element for buttons, links, headings, labels, and form controls.
   - Maintain logical heading order.
   - Connect labels and error messages to inputs.

8. Build the reusable variant API.
   - Centralize repeated variants.
   - Keep business logic outside the component.
   - Do not create page-specific copies of a shared component.

9. Add keyboard and screen-reader behavior.
   - Keep focus visible.
   - Support keyboard activation.
   - Do not communicate status with color alone.
   - Announce processing and error states where needed.

10. Make the component responsive.
    - Use the same semantic tokens at all widths.
    - Adjust layout or select another approved typography role.
    - Do not create a second mobile design system.

11. Validate content behavior.
    - Support long filenames, notes, Chat responses, and translated browser labels without breaking layout.
    - Do not truncate important academic content without a way to view it.

12. Verify no token bypass.
    - Search for raw hex, RGB, named colors, and arbitrary Tailwind values.
    - Confirm that Tailwind utilities map to approved CSS variables.

## Code Skeleton

```ts
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/ui/cn";

const buttonVariants = cva(
  [
    "inline-flex items-center justify-center",
    "font-label-large",
    "focus-visible:outline-none",
    "focus-visible:ring-2",
    "focus-visible:ring-primary",
    "disabled:pointer-events-none",
    "disabled:opacity-50",
  ],
  {
    variants: {
      intent: {
        primary: "bg-primary text-on-primary",
        secondary: "bg-secondary text-on-secondary",
        destructive: "bg-error text-on-error",
      },
      size: {
        default: "px-space-200 py-space-150",
        compact: "px-space-150 py-space-100",
      },
    },
    defaultVariants: {
      intent: "primary",
      size: "default",
    },
  },
);

type ButtonProps = React.ButtonHTMLAttributes<HTMLButtonElement> &
  VariantProps<typeof buttonVariants>;

export function Button({
  className,
  intent,
  size,
  type = "button",
  ...props
}: ButtonProps) {
  return (
    <button
      type={type}
      className={cn(buttonVariants({ intent, size }), className)}
      {...props}
    />
  );
}
/* Central mapping. Do not repeat this inside components. */
:root {
  --ds-color-primary: var(--color-roles-primary-color-roles-primary);
  --ds-color-on-primary: var(--color-roles-primary-color-roles-on-primary);
  --ds-color-surface: var(--color-roles-surface-color-roles-surfcace);
  --ds-space-200: calc(var(--spacing-collection-space-200) * 1px);
  --ds-body-large-size: calc(var(--typography-body-large-fontsize) * 1px);
}
```

## Common Traps

- Using primitive color tokens directly.
- Adding raw hex values.
- Using Tailwind arbitrary values.
- Choosing a text color without the matching on-* role.
- Applying only a typography font size and ignoring its line height or weight.
- Inventing a green success token.
- Removing keyboard focus outlines.
- Communicating processing or error only with color.
- Duplicating the same component for another page.
- Putting Prisma, billing, storage, or AI logic inside the component.
- Adding dark mode without approved tokens.
- Creating custom shadows or spacing values.

## Verify Before Done

- [ ] The component implements only approved product behavior.
- [ ] Every required interaction state exists.
- [ ] Primitive colors are not used.
- [ ] Semantic background and foreground roles are paired.
- [ ] No raw colors or arbitrary Tailwind values were added.
- [ ] DM Sans and approved typography roles are used.
- [ ] Approved spacing tokens are used.
- [ ] Only approved outline, surface, and shadow roles are used.
- [ ] Semantic HTML is used.
- [ ] Labels, errors, and controls are connected.
- [ ] Keyboard focus is visible.
- [ ] Status is not communicated by color alone.
- [ ] The component works at supported responsive widths.
- [ ] Long user content does not break the layout.
- [ ] Shared variants are centralized.
- [ ] Business logic remains outside the component.
- [ ] WCAG 2.1 AA checks pass.

Write tests for:

- Default rendering.
- Keyboard focus and activation.
- Disabled state.
- Loading state.
- Error state where applicable.
- Accessible name and label association.
- Long content.
- Responsive layout behavior.
- Variant rendering.
- Absence of raw color and arbitrary-value classes in the component.