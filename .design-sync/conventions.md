## Wrapping and setup

No root provider/wrapper component is required to render these components correctly styled — colors, spacing, radii, and shadows are plain CSS custom properties available globally at `:root` the moment `styles.css` loads (no context, no theme object). Dark mode is a pure CSS mechanism, not a component: it activates automatically via `prefers-color-scheme: dark`, or can be forced per-subtree with a `data-theme="dark"` (or `"light"`) attribute on any ancestor element — there is no `<ThemeProvider>` to import.

The one component that IS a required wrapper is `ToastProvider` — wrap the app (or the subtree that shows toasts) in it once, then call the `useToast()` hook's `toast({ title, description, variant })` from anywhere inside to enqueue one. `Dialog` and other components take plain controlled props (`isOpen`/`onOpenChange`) and need no provider.

## Styling idiom

Style through Tailwind utility classes using this design system's semantic color vocabulary — never raw hex values or Tailwind's default palette (`bg-blue-500` etc. do not exist in this bundle; only the names below are shipped):

| Role | Classes |
|---|---|
| Surface | `bg-background`, `bg-muted` |
| Text | `text-foreground`, `text-muted-foreground` |
| Brand/primary action | `bg-primary`, `text-primary`, `text-primary-foreground`, `border-primary` |
| Status | `bg-success` / `text-success` / `text-success-foreground`, `bg-warning` / `text-warning-foreground`, `bg-destructive` / `text-destructive` / `text-destructive-foreground` / `border-destructive` |
| Borders | `border-border` |
| Event-type colors | `bg-feeding`, `bg-feeding-breast`, `bg-feeding-bottle`, `bg-feeding-solid`, `bg-sleep`, `bg-diaper`, `bg-diaper-pee`, `bg-diaper-stool`, `bg-diaper-both` |
| Radius | `rounded-sm` / `rounded-md` / `rounded-lg` / `rounded-full` |
| Shadow | `shadow-sm` / `shadow-md` / `shadow-lg` |
| Spacing | standard Tailwind numeric scale (`p-4`, `gap-2`, `px-3`, …) — this design system's spacing tokens ARE the Tailwind scale, not a separate one |

Component variant props (not classes) drive component-level style choices — e.g. `<Button variant="primary" size="md">`, `<Badge variant="destructive">` — using `class-variance-authority` under the hood. Prefer the `variant`/`size` props over hand-composing utility classes for these; use utility classes for layout/spacing around components, not for overriding their internal variant colors.

## Where the truth lives

- `styles.css` (and its `@import` closure) is the complete, authoritative stylesheet — every class and CSS custom property a design can use comes from here.
- `tokens/` mirrors the same values as data (color/typography/spacing/radii/shadows), useful for reading exact values without parsing CSS.
- Per-component `.prompt.md` files document each component's exact props and usage examples — read the specific component's file before composing with it, since prop names (e.g. `variant`, `isLoading`, `error`) vary per component.

## Example

```tsx
<Card>
  <Card.Header>
    <h2 className="text-lg font-semibold text-foreground">Last feeding</h2>
  </Card.Header>
  <Card.Body>
    <div className="flex items-center gap-2">
      <Badge variant="feeding">Breastfeeding</Badge>
      <span className="text-sm text-muted-foreground">2 hours ago</span>
    </div>
  </Card.Body>
  <Card.Footer>
    <Button variant="secondary" size="sm">Details</Button>
  </Card.Footer>
</Card>
```
