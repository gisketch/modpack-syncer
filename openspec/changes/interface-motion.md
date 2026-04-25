# Change: interface-motion

## Summary

Add subtle app-wide motion using Motion for React: route transitions, page content stagger, dialog section stagger, sidebar entry stagger, and tactile button press feedback.

## Requirements

1. Add `motion` as the React animation dependency.
2. Route changes SHOULD animate smoothly with transform/opacity and `AnimatePresence`.
3. Page content SHOULD stagger after navigation without disruptive initial-load animation.
4. Dialog header/body/footer SHOULD stagger on open.
5. Sidebar navigation entries SHOULD slide in subtly.
6. Button press feedback SHOULD use `scale(0.96)`.
7. Reduced-motion preference MUST be respected.
