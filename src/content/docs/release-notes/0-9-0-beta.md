---
title: 0.9 Beta release notes
description: First public release of Ditana GNU/Linux — the foundational beta from December 2024.
release:
  version: '0.9'
  label: Beta
  date: 2024-12-31
---

The first public beta of Ditana GNU/Linux. This release established the foundation: an Arch-based system targeting educated enthusiasts who want both transparency and convenience, with security as a first-class concern rather than an afterthought.

## Highlights

- **Hardware-aware installer.** Dialog-driven installation that considered hardware specifics and inter-package dependencies — particularly NVIDIA detection across legacy and modern GPUs.
- **XFCE desktop environment** as the single shipped option, with pre-installed enhancements including the Docklike Taskbar.
- **Modular package structure.** Distribution-specific behaviour split into individual Arch packages, laying the groundwork for the later configuration-as-data refactor.
- **CPU vulnerability detection and mitigation.** Per-CPU detection of speculative execution vulnerabilities (Spectre v2, Meltdown, MDS, TAA, MMIO Stale Data, RETBleed, SRSO, GDS, RFDS) with documented per-mitigation trade-offs in the installer dialog — already a Ditana hallmark in this first release.
- **Security defaults out of the box.** Firewall pre-configured, optional system partition encryption, restrictive sysctl baseline.
- **Performance defaults.** Weekly TRIM scheduling on supported SSDs, ZRAM, rate-mirrors for fastest mirror selection.
- **Headless support.** A single ISO that could deploy either a desktop system or a headless one, decided in the installer.

## Coverage

Released on 31 December 2024 and covered shortly after on [gnulinux.ch](https://gnulinux.ch/ciw119-podcast) in an hour-long interview with Ralf Hersel. A DistroWatch banner ran from 12 January to 3 February 2025, drawing approximately 120,000 impressions.

## What changed since

The 0.9.3 release rebuilt almost everything around the principle of [configuration as data](/under-the-hood/configuration-as-data/), expanded the desktop environment selection from one to four (XFCE, Wayfire, Niri, COSMIC), added a dedicated [system hardening dialog](/under-the-hood/mitigations/), introduced [Flatpak integration](/best-practices/aur-vs-flatpak/), and migrated the configuration management layer from Ansible to Sparrow6. See the [0.9.3 release notes](/release-notes/0-9-3-beta/) for the full list.

Since then, 0.9.4 has restricted unprivileged user namespaces to the executables that require them rather than disabling them entirely, introduced unattended installation via an answer file, and made every package build public. See the [0.9.4 release notes](/release-notes/0-9-4-beta/) for the current release.
