---
title: AUR vs Flatpak
description: Native packages first, then Flatpak, then AUR — and why Ditana ships Brave from AUR rather than Flathub.
---

Ditana supports native Arch packages, AUR packages built locally with `paru`, and Flatpak applications sandboxed from Flathub. The priority sequence is **native first, followed by Flatpak, then AUR** – and the justification for moving beyond a native package is never that Flatpak offers better experience, but that no native package is available.

## When Flatpak is the better choice

When Arch itself does not carry a package, favour Flatpak over the AUR for a desktop application that has a maintained Flathub build.

- **Sandboxing.** Flatpak applications run in a `bubblewrap` sandbox with restricted filesystem and IPC access. For browsers, media players, and other internet-facing software, this is a real defence-in-depth layer.
- **No build time.** AUR packages built from source can take minutes (or hours, for large applications like LibreOffice). Flatpak deployments download pre-built binaries from Flathub.
- **No ABI risk.** Binary AUR packages occasionally break when system libraries are updated and the upstream binary expects a different ABI. Flatpaks bundle their runtime and are insulated from that risk.
- **Predictable updates.** Flathub releases are versioned and easy to roll back. AUR is rolling and uncoordinated.

## When AUR is the better choice

There are three cases where Ditana prefers — or requires — AUR over Flatpak.

Ditana already rebuilds and signs 45 of the AUR recipes it needs, so `paru -S` will often resolve them from the Ditana repository rather than from the AUR. Every one of those was classified before it was built: a change to a source URL, to a build function, or to a checksum without a version stops the whole run for a person to look at. Recipes Ditana does not carry are installed by `paru` straight from the AUR, unreviewed, which is the difference the rest of this page is about.

### Chromium-based browsers under Ditana's default hardening

Ditana does not hand unprivileged user namespaces to each program. They have formed the basis of several published local privilege escalations, and of the sixteen Linux kernel entries in CISA’s [Known Exploited Vulnerabilities catalogue](https://www.cisa.gov/known-exploited-vulnerabilities-catalog) over three years, six are exploitable via them – counted against catalogue version 2026.09.04, and the reading of which six is ours, so it is worth checking rather than believing. Ditana therefore allows them on a per-program basis: a minimal BPF program attached to the kernel’s own `userns_create` hook refuses a namespace to any executable that a setting has not requested. `bwrap` has requested it, so every Flatpak builds its outer sandbox as usual.

Brave nevertheless comes from the AUR as `brave-bin`, for two reasons that have nothing to do with the outer sandbox. Its Flatpak carries `zypak`, which establishes additional namespaces from a binary of its own deep inside the sandbox, and whether a per-executable allowlist extends to those at all is untested. And an executable within a Flatpak is replaced by `flatpak update`, which the hook responsible for maintaining the allowlist in sync does not see, so the permission would silently expire on the next update.

The AUR package `brave-bin` needs none of this. It brings its own setuid `chrome-sandbox` helper and builds its sandbox without a user namespace at all – which is why this one remains in place even though the rule puts Flatpak ahead of the AUR.

#### If a sandbox you installed yourself is refused

If a sandbox you installed yourself is refused a user namespace, the guard is what refused it. Add the executable to `/etc/ditana/userns-allow.conf`, one absolute path per line, and reload:

```bash
sudo ditana-userns-guard --reload
```

`sudo ditana-userns-guard --status` shows how many namespaces have been permitted and refused since the guard was loaded, and lists the programs it refused, the most recent first, each with the user who ran it and how often. `sudo ditana-userns-guard --observe` stops refusing and keeps the list, so it shows what a program would ask for while the program keeps running; `sudo ditana-userns-guard` switches refusing back on.

### Software not available on Flathub

A non-trivial fraction of useful Linux software lives only on AUR — niche developer tools, vendor-specific drivers, hardware utilities, fonts. For these, AUR is the only option, and `paru` makes installing them straightforward.

### When you want to participate in the AUR ecosystem

If you're an Arch user who wants to follow AUR commit feeds, contribute votes, or maintain your own AUR packages, sticking with AUR for daily applications keeps you in that loop.

## How Ditana decides at install time

The KDL configuration lets each setting declare `arch-packages`, `flatpak-packages` and `aur-packages` side by side, and `userns-allow` for an executable whose sandbox needs a user namespace. When more than one source is available, the choice is made deliberately, package by package, with an explanation recorded in the relevant `.kdl` file. Browse [ditana-config](https://github.com/acrion/ditana-config) to see the reasoning in context.

## Practical tip: review installed Flatpaks regularly

Flatpak runtimes accumulate. Run `sudo flatpak uninstall --unused` occasionally to reclaim disk space – and `sudo flatpak update` to keep applications current. Both are safe operations. Ditana installs Flatpaks into the system installation rather than a per-user one, which is why both need root.
