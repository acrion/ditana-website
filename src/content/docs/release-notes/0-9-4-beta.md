---
title: 0.9.4 Beta release notes
description: Unprivileged user namespaces are restricted per executable rather than being disabled, installation can run unattended from an answer file, and every package build is published for anyone to check.
release:
  version: '0.9.4'
  label: Beta
  date: 2026-09-12
  isoSize: 1.9 GB
---

## Unprivileged user namespaces: restricted, not switched off

Arch removed `bubblewrap-suid` in September 2026. Ditana had relied on it to keep sandboxes working while unprivileged user namespaces stayed switched off, so its removal broke both halves of that setup simultaneously – and since the installer fetches its configuration at runtime, it broke installations from the already released 0.9.3 medium as well, not just those newly created.

There was no replacement to move to. Upstream removed setuid support in bubblewrap 0.12.0, one day after 0.11.2 fixed CVE-2026-41163, a privilege escalation that existed solely in that mode, and the 0.11.x branch that was made available to whoever still needed it was never adopted by anyone.

So the arrangement is now reversed. Rather than disabling user namespaces for all and making one binary exempt, Ditana allows them on a per-executable basis. A BPF program attached to the kernel's `userns_create` hook refuses a namespace to anything that has not been declared, and the declaration sits in the configuration next to the package that needs it:

```kdl
- name="flatpak" default-value=#true {
    arch-packages "flatpak"
    userns-allow "/usr/bin/bwrap"
  }
```

An essential point, since it determines the outcome in case of errors: a hook of this kind can only ever refuse, never grant. The sysctl that previously disabled user namespaces must be raised for the guard to have anything to act upon, and it is raised only by the service that has already loaded and attached the program. A machine that cannot load it keeps user namespaces entirely switched off. The failure forfeits your sandboxes but never your protection.

The guard is a separate package, [ditana-userns-guard](https://github.com/acrion/ditana-userns-guard), installed together with the **System Hardening** option that used to be called "Disable unprivileged user namespaces".

## LibreWolf now comes from Arch

LibreWolf now comes from the Arch repositories rather than from Flathub, adhering to the preference hierarchy that puts a native package first. Brave continues to be available via the AUR; the rationale is detailed on the [AUR vs Flatpak](/best-practices/aur-vs-flatpak/) page.

## Every sysctl value is declared as data

Every sysctl value the installer writes is now declared as data rather than assembled as shell text. Two settings that write the same key with different values stop the installation and are both named. Previously, both lines were written and the last one silently won.

## Unattended installation

An installation can now run with nobody present at the keyboard. An answer file pre-supplies what the installer would normally request, and it appears on a small config drive that the installer discovers independently – the identical setup a hosting provider would use to set Ditana up over PXE. No keystrokes are simulated anywhere: the mechanism is the installer reading its answers rather than soliciting them, which is why it works for a provider and not just for a test.

The account password is taken from the answer file as a hash, never in the clear. An example file is available in the installer repository, and the mechanism is documented there in full.

An answer that cannot take effect stops the installation instead of being dropped in silence: a setting this machine does not offer, and one that a default expression would overwrite again, are both refused by name, together with the condition that makes them impossible. And because nobody is watching the screen, a run that stops writes its cause to the first serial port, every line carrying the marker `DITANA-AUTOINSTALL-ABORT:`, so that a provisioning system reading the console learns the reason while the machine is still up rather than waiting out a silence. Where the console is elsewhere, the kernel command line names it.

This is also what Ditana uses on itself. Every night the build host installs the repository it has just built into a virtual machine, unattended, and the packages are released only if the installed system boots and answers for itself.

See [`docs/unattended-installation.md`](https://github.com/acrion/ditana-installer/blob/main/docs/unattended-installation.md).

## ZFS on the installation medium

The live medium booted a kernel lacking the ZFS module, causing a ZFS installation to fail on hardware where it had previously succeeded. The ZFS packages are now delivered via pacstrap and the initramfs is rebuilt afterwards, and `zfsbootmenu` is added by the hook responsible for it rather than through a second path that might conflict with it. The UEFI fallback boot path was wrong and has been corrected.

## Printing

Printer support is complete. mDNS is opened in firewalld and `avahi-daemon` is enabled, so a network printer is discovered rather than typed in.

## Hardware

Firmware on some machines leaves the processor to remain in its shallowest idle state after a suspend, which costs power for as long as the machine stays up. Ditana now detects that and works around it.

A new option binds ARP replies to the interface that received the request. On a machine with more than one interface in the same subnet, the kernel otherwise answers from whichever one it likes, which confuses switches and some load-balancing setups.

Graphics detection now inquires if the GPU is functional under Wayland rather than whether it accelerates anything, which is the question the desktop choices actually depend on.

## Memory

Extended ZRAM Overcommit raises the virtual size of the compressed in-RAM swap from 100% to 175% of physical RAM and the zstd effort from level 3 to level 6, so a machine holds roughly 1.75 times its RAM in compressed form before it touches the disk swap partition. Page-in latency remains the same, because zstd decompresses at the same speed whatever the level cost. The default stays unchanged.

## The installation medium itself

The ISO is constructed using archiso 90. `b43-firmware` has been removed from it: the package pulled the mainline kernel into the medium beside the one Ditana boots. The build process has been made stricter – nothing copied into the medium can now follow a symlink back into the live system, the permissions of what is placed inside are declared rather than inherited, and several gigabytes of intermediate files are stored on a disk instead of a tmpfs.

What the medium carries is the versioned state and nothing more: a file that lies in the working tree and that no rule of the repository declares stops a signed build, since everything beneath the profile’s airootfs enters the image. The installed system then records its origin, as `BUILD_ID` and `VERSION_CODENAME` in `/usr/lib/os-release`: which medium built it, and which configuration state that medium carried.

## Builds you can check

Every package Ditana ships is rebuilt from its upstream recipe, signed, and published only as a complete set: if one package fails to build or its sources cannot be verified, nothing is published at all. Since 0.9.3 that process has become visible. Every run is recorded and made public, including the runs that shipped nothing, and every package that was rebuilt links the log of its own build.

Two things have been incorporated since. Every alteration introduced by an upstream recipe is classified before anything is built, and anything that is not safe by construction halts the whole run for a human to inspect – the AUR has been under an active supply-chain attack, and Ditana rebuilds AUR recipes into a repository its users trust via pacman’s signature configuration. And a repository that builds and signs without issues can still be one nobody can install from, so it is installed into a virtual machine before it is released.

The pipeline that all of this relies on is now public as well. It is older than Ditana: it began around 2023 as a single shell script and was never intended for anyone else’s eyes. It is published because the claims the build page makes are worth what their evidence is worth, and it is part of the evidence. It is at
[github.com/acrion/ditana-build](https://github.com/acrion/ditana-build), and
the runs it records are at [ditana.org/builds](/builds/).

Packages are signed with a dedicated signing subkey instead of the primary key. A subkey may be revoked and replaced independently, and it cannot certify further keys. Nothing has to be done about this: the keyring carrying it was shipped in August and has long since been picked up.

## Upgrading from 0.9.3

Installations created using the 0.9.3 medium continue to function, with a single case that must be resolved manually. `bubblewrap-suid` no longer exists, so the next system update replaces it, and Flatpak and Bubblejail stop working on a machine where unprivileged user namespaces are disabled. Brave and other AUR applications are unaffected.

The remedy is the guard described above:

```bash
sudo pacman -Syu ditana-userns-guard
echo /usr/bin/bwrap | sudo tee /etc/ditana/userns-allow.conf
sudo systemctl enable --now ditana-userns-guard.service
```

One absolute path per line; `#` starts a comment. The service refuses to raise
the sysctl unless it has loaded and attached the program first, so a machine on
which it cannot run stays exactly as locked as it was.

An older medium cannot install at all any more. The installer fetches its configuration when it runs, so a 0.9.3 USB stick reaches for packages its own repository can no longer supply and stops. Write the current image to it.

A fresh installation from the 0.9.4 medium needs none of this.
