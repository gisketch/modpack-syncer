# Change: onboarding-stepper-default-directory

## Summary

Rebuild onboarding as a non-scrolling stepper window and add a configurable install directory for managed app data.

## Requirements

1. Onboarding MUST use one active step at a time with a segmented progress indicator.
2. Onboarding MUST collect a default install directory before Java, Prism, and username setup.
3. Managed Java runtimes, managed Prism installs, and cloned pack repositories MUST use the configured install directory.
4. Onboarding completion MUST require default directory, managed Java, Prism, and offline username, then route to Packs.
5. Onboarding MUST NOT require cloning a pack before showing the Packs page.
