---
title: 'Updating is not optional'
description: 'Why a rolling release must be updated entirely, how to update Ditana on the desktop or in a terminal, and what actions to take afterwards.'
---

Ditana is Arch Linux underneath, and Arch is a rolling release. There is no
"version" to stay on: there is one moving target, and every package in the
repositories is built against the libraries that are current *today*. A system
that has not been updated for a few months is not a stable older system — it is
a system whose next update is a large, untested jump.

Two consequences are worth stating plainly:

- **Security fixes only arrive if you update.** There is no separate backport
  channel. The fix for a vulnerability in a library reaches you as a new version
  of that library, and not otherwise.
- **Never update a single package.** `pacman -Sy something` synchronises the
  package databases and then installs one package against libraries that may
  already have moved on. This is a *partial upgrade*, it is the single most
  common way to break an Arch system, and it is unsupported. Update everything
  or nothing: `-Syu`, never `-Sy` followed by an install.

  (The one deliberate exception is the [keyring repair](/troubleshooting/signature-errors/#the-repair), and it is safe for a specific reason that is explained there.)

## The graphical way

Ditana installs a software centre on every desktop:

| Tool | Installed with | Covers |
| --- | --- | --- |
| **Pachub** | XFCE, Niri, Wayfire, COSMIC | Packages from the Arch and Ditana repositories |
| **Bazaar** | Niri, Wayfire | Flatpak applications from Flathub |
| **COSMIC Store** | COSMIC | Flatpak applications from Flathub |
| **Kalu** | XFCE | Notifies you when updates are waiting |
| **arch-audit-gtk** | all desktops | Tray indicator that turns red when an installed package has a known vulnerability |

Pachub and the Flatpak stores cover different halves of the system, so running
one is not the same as running both. If your desktop has no Flatpak store, the
terminal command below covers it.

## The terminal way

This is the recommended route, because one command covers the repositories
*and* the AUR packages you have installed:

```sh
paru -Syu          # Arch repos + Ditana repo + your AUR packages
flatpak update     # sandboxed applications from Flathub
```

`paru` is Ditana's chosen AUR helper and is installed on every system,
including headless ones. Plain `pacman -Syu` also works, but it leaves AUR
packages behind — and an AUR package left behind while its dependencies move on
is exactly the ABI mismatch that produces "symbol lookup error" a week later.

**Let it run to its end.** On a system using ZFS, every kernel update rebuilds the ZFS module. pacman then shows `Install DKMS modules` and a line beginning with `==> dkms install`, and afterwards nothing for several minutes. That is not a hang. Interrupting it leaves the new kernel missing its ZFS module, and the next boot ends in a kernel panic reading `Attempted to kill init!`. If this has occurred, revert to the snapshot created prior to the update, as [Automatic system snapshots](/best-practices/automatic-system-snapshots/) describes.

## After the update

- **Configuration files.** When a package ships a new default for a file you
  have edited, pacman writes it beside yours as `*.pacnew` and says so. Merge
  them with `sudo pacdiff` (from `pacman-contrib`, installed by default).
  Ignoring `.pacnew` files for a year is a slow way to accumulate breakage.
- **Reboot after a kernel update.** Until you do, the running kernel no longer
  matches the modules on disk, and loading a module that was not already
  in memory will fail.
- **Snapshots.** If you enabled automatic snapshots during installation, the
  state before the update is still on disk and you can boot into it. See
  [Automatic system snapshots](/best-practices/automatic-system-snapshots/).

