---
title: Troubleshooting
description: Keeping a Ditana system healthy — updating properly, repairing signature errors, recovering from a bad update, and where to report a bug.
---

Most problems on a rolling-release system come from one of three things: a
system that has not been updated in a while, a signature check that cannot
succeed because a keyring is out of date, or an update that changed something
you were relying on. These pages cover all three, and the last of them explains where to report what is left.

If you are stuck, the [Discord channel](https://discord.gg/RgcdumdE9J) is the
fastest place to ask.

- [Updating is not optional](/troubleshooting/updating/) – Why a rolling release must be updated entirely, how to update Ditana on the desktop or in a terminal, and what actions to take afterwards.
- ["invalid or corrupted package (PGP signature)"](/troubleshooting/signature-errors/) – What should be done when pacman refuses a package due to its inability to validate the signature, and how to manually verify Ditana's signing key yourself.
- [An update broke something](/troubleshooting/an-update-broke-something/) – Four steps to discover what an update changed and to get a functioning system back.
- [Ditana's rescue system](/troubleshooting/rescue-system/) – How the installation medium finds out why an installed Ditana no longer boots, repairs the most common cause, and opens a shell in the installed system.
- [Flatpak or Bubblejail stopped working after an update](/troubleshooting/flatpak-and-bubblejail/) – How to restore Flatpak and Bubblejail on a machine installed from the 0.9.3 medium.
- [A Chromium-based program aborts: "The SUID sandbox helper binary was found, but is not configured correctly"](/troubleshooting/chromium-sandbox-helper/) – Why Discord and other programs built on Chromium or Electron may abort at start under Ditana's hardening, and how to fix it.
- [Reporting a bug](/troubleshooting/reporting-a-bug/) – Which of Ditana's repositories a problem belongs in, and what a useful report contains.
