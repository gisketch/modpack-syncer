# Spec: interface-motion

Motion behavior for app-level UI polish.

## Requirements

1. App motion SHOULD use the `motion` package for React route and layout transitions.
2. Page transitions SHOULD animate with transform and opacity, not layout-affecting properties.
3. Route content SHOULD stagger entrance after navigation while avoiding disruptive first-paint animation.
4. Dialog sections SHOULD enter with subtle staggered transform and opacity animation.
5. Sidebar navigation items SHOULD enter with subtle horizontal stagger.
6. Motion MUST respect `prefers-reduced-motion` by reducing animation and transition durations.
7. Scroll behavior MAY be smooth, but the app MUST NOT fake heavy rubber-band physics that could fight native desktop webview scrolling.

## See

- [src/app.tsx](../../src/app.tsx)
- [src/components/ui/motion.tsx](../../src/components/ui/motion.tsx)
- [src/components/ui/dialog.tsx](../../src/components/ui/dialog.tsx)
- [src/styles/index.css](../../src/styles/index.css)
