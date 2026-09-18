---
title: 'Flatpak or Bubblejail stopped working after an update'
description: 'How to restore Flatpak and Bubblejail on a machine installed from the 0.9.3 medium.'
---

Flatpak and Bubblejail apps ceased launching following a routine update on a machine installed from the 0.9.3 medium. `bubblewrap-suid` no longer exists, so the update replaced it, and unprivileged user namespaces are disabled on such a system.

Check first that this is your situation: `sysctl kernel.unprivileged_userns_clone` has to say `0`. If it says `1`, every program already gets a user namespace and Flatpak has stopped for some other reason. The guard would then take the namespaces away from every program that is not on the list, and not every program survives that – see [A Chromium-based program aborts](/troubleshooting/chromium-sandbox-helper/).

Install the guard, specify which executable is permitted to use one, and switch it on:

```bash
sudo pacman -Syu ditana-userns-guard
echo /usr/bin/bwrap | sudo tee /etc/ditana/userns-allow.conf
sudo systemctl enable --now ditana-userns-guard.service
```

The first command updates the whole system, which on a machine that has not been updated for a while can take long. Let it run to its end, as described under [The terminal way](/troubleshooting/updating/#the-terminal-way).

The [0.9.4 release notes](/release-notes/0-9-4-beta/) explain why the arrangement changed.

