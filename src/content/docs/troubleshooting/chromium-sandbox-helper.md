---
title: 'A Chromium-based program aborts: "The SUID sandbox helper binary was found, but is not configured correctly"'
description: 'Why Discord and other programs built on Chromium or Electron may abort at start under Ditana''s hardening, and how to fix it.'
---

Discord and other programs built on Electron or Chromium can stop right at startup with this message:

```
FATAL:sandbox/linux/suid/client/setuid_sandbox_host.cc:166] The SUID sandbox helper binary was found, but is not configured correctly. Rather than run without sandboxing I'm aborting now. You need to make sure that /home/user/.config/discord/app-1.0.157/chrome-sandbox is owned by root and has mode 4755.
```

Chromium puts the pages it renders inside a sandbox, and it supports two ways to build one: a user namespace, or, if a user namespace is denied, the setuid helper `chrome-sandbox` that is included with the program. When the [guard](/best-practices/aur-vs-flatpak/#chromium-based-browsers-under-ditanas-default-hardening) is active, any program not on its list is refused the namespace, and Chromium switches to the helper. If the helper was installed without the setuid bit, Chromium terminates instead of proceeding without a sandbox.

Whether a program is affected therefore depends on its helper. Arch installs the helper setuid for `chromium`, for every `electron` package and for `signal-desktop`, and the AUR's `brave-bin` does the same, so these start as before. Affected are programs that bring a Chromium of their own with an ordinary helper, which is common among the AUR's `-bin` packages, and every program that runs from your home directory. Discord is one of those: the `discord` package from the Arch repository installs only a launcher, which downloads Discord into `~/.config/discord` and starts it from there.

To confirm that the guard is the one that refused it, ask the guard. `sudo ditana-userns-guard --status` lists the programs it has refused, the most recent first, each with the user who ran it and the frequency; a line such as `refused  3x uid 1000 Discord, 12 s ago` names the culprit. Version 1.00 of the guard only counts: there, run it before and after starting the program, and if `denied` increased, it was the guard.

For a program in your home directory, use its Flatpak instead:

```bash
sudo flatpak install flathub com.discordapp.Discord
sudo pacman -Rns discord
```

Flatpak builds its sandbox using bubblewrap, which is on the list, and Discord's own sandbox then executes within it. Do not do what the message asks for in this case. A setuid root file in your home directory gives root privileges to a binary that the program's own updater downloaded and nobody verified, and the next update puts a new one next to it.

## A Chromium-based program from a package

Most programs built on Chromium or Electron that come from a package begin normally, since their package installs the sandbox helper setuid root, as Arch’s chromium and electron packages do. The message shows up only in cases where a package installs the helper without that bit, which is rare and mostly concerns AUR `-bin` packages that bring an Electron of their own. Every other package is unaffected: it does not have such a helper. The remedy is to give the helper the bit. Chromium then needs no user namespace at all, which is why this is better than placing the program on the guard’s list. This lists every helper on the system that lacks it:

```bash
find /usr /opt -type f \( -name chrome-sandbox -o -name chrome_sandbox \) \( ! -user root -o ! -perm -4001 \)
```

Setting the bit once is not enough, because the next update of the package writes the file back as it was. A pacman hook sets it again after every update. For each path the command printed, set `helper` to it and run:

```bash
helper=/opt/example/chrome-sandbox
sudo mkdir -p /etc/pacman.d/hooks
sudo tee "/etc/pacman.d/hooks/$(pacman -Qqo "$helper")-chrome-sandbox.hook" > /dev/null <<HOOK
[Trigger]
Type = Path
Operation = Install
Operation = Upgrade
Target = ${helper#/}

[Action]
Description = Making the Chromium sandbox helper in ${helper%/*} setuid root...
When = PostTransaction
Exec = /usr/bin/chmod 4755 $helper
HOOK
sudo chmod 4755 "$helper"
```

Unlike a helper in your home directory, this one is part of a package that pacman installed and verified, and a setuid helper is exactly how Arch ships Chromium itself.

A helper lacking the bit is a packaging defect. The file exists solely to be setuid root and can do nothing without it, and the package’s own program confirms this in the message above. Nor is this peculiar to Ditana: Arch’s own linux-hardened kernel switches unprivileged user namespaces off by default, and [the Arch Wiki](https://wiki.archlinux.org/title/Security#Disable_unprivileged_user_namespaces) states that Chromium-based applications then need the setuid bit on chrome-sandbox. Report it, so that the next update fixes it for everybody and the hook is no longer needed. `pacman -Si <package>` shows the repository it came from; a package that `pacman -Qm` lists came from the AUR instead:

- **Arch repository:** an issue at `https://gitlab.archlinux.org/archlinux/packaging/packages/<package>/-/issues`.
- **AUR:** a comment at `https://aur.archlinux.org/packages/<package>`.
- **Ditana repository:** an issue at [ditana-build](https://github.com/acrion/ditana-build/issues). Ditana builds these packages from AUR recipes and takes the report there.

It helps to mention the fix: installing the helper with mode 4755, as Arch’s chromium and electron packages do.

