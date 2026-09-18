---
title: 'Reporting a bug'
description: 'Which of Ditana''s repositories a problem belongs in, and what a useful report contains.'
---

Ditana is developed in three repositories, and the right one follows from two questions: **did the problem appear while installing, or while using an installed system?** And if it is an installed system, **is it the packaging or the configuration?**

- **[ditana-installer](https://github.com/acrion/ditana-installer/issues)** —
  the ISO and the installation process. The live environment does not boot;
  the installer stops with an error; disk partitioning or encryption fails; the
  installed system does not boot at all; something you selected in the
  installer's dialogs did not end up on the installed system.

- **[ditana-build](https://github.com/acrion/ditana-build/issues)** – the packages themselves and the pipeline that builds them. A missing dependency, a package that will not install, a signature that does not verify, a package that is out of date.

- **[ditana-config](https://github.com/acrion/ditana-config/issues)** — what an
  installed Ditana system *is*. Package selection, desktop configuration,
  defaults and dotfiles, systemd units, kernel parameters and CPU mitigations,
  Ditana's own helper scripts. If the system boots and something in it is wrong
  or missing, this is the place.

If you cannot tell, open it in **ditana-config** and say so — it is easier to
move an issue than to have it go unreported.

A useful report contains:

- The Ditana version and the configuration it was installed with, from `grep -E '^(BUILD_ID|VERSION_CODENAME)=' /etc/os-release`, and the kernel from `uname -r`.
- What you expected, what happened, and the exact command or click that
  produced it.
- The relevant error, copied as text rather than photographed.
- For an installer problem: `/var/log/install_ditana.log`, which the installer
  also copies into the installed system.
- For a service that fails: `systemctl status <unit>` and
  `journalctl -u <unit> -b`.
- For a hardware problem: `print-system-infos`, which is installed by default with the terminal tools and summarizes CPU, GPU, memory and firmware in one screen. Install it with `pacman -S ditana-print-system-infos` if you unchecked that option.

Please do not report AUR packages here. Ditana rebuilds their recipes from the AUR unchanged; if the software itself is broken, the AUR page or the upstream project is where a fix can actually be made. If the *packaging* in Ditana’s repository is at fault – a missing dependency, a package that will not install – that is a ditana-build issue and we do want to hear about it.
