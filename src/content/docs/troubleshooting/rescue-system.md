---
title: 'Ditana''s rescue system'
description: 'How the installation medium finds out why an installed Ditana no longer boots, repairs the most common cause, and opens a shell in the installed system.'
---

When a deployed Ditana fails to boot, the installation medium may inspect it from the outside and often repair it. Boot the medium: it recognizes the installation and asks `Detected Ditana installation. Enter rescue system?`. Answer yes. The keyboard layout is US at this point, and an encrypted system asks for its passphrase.

The rescue system then imports the installed system and attaches it to `/mnt`. On ZFS it initially verifies why the system might fail to start: whether the kernel in `/boot` includes the ZFS module, whether the initramfs carries that module, and whether the last update ran to its end. The most frequent cause is an update that was halted during the rebuilding of the ZFS module or the initramfs, and it concludes with a kernel panic reading `Attempted to kill init!`. If the check finds something it can repair, it shows what it found and what it would do, and asks. A repair that finishes an interrupted update needs a network connection: ethernet works by itself, Wi-Fi is configured using `iwctl`. Following a successful repair, it provides an option to reboot. Remove the medium first.

Whatever the check finds, it keeps its report in the installed system as `/var/log/ditana-diagnosis-<date>.tar.gz`. Attach it to a bug report.

If there is nothing to repair, or you decline, you get a shell within the installed system. It lists the snapshots and says how to roll back to one, which [Automatic system snapshots](/best-practices/automatic-system-snapshots/) explains in detail. Leave the shell with `exit`.

The check may also be executed manually from the medium, as root: `/root/diagnose-boot.sh` only reads, `/root/diagnose-boot.sh --repair --dry-run` shows what a repair would do, and `/root/diagnose-boot.sh --repair` performs it. A medium from before this check proceeds directly to the shell. There, `mkinitcpio -P` rebuilds the initramfs, and afterwards `lsinitcpio /boot/initramfs-linux-lts.img | grep zfs.ko` must print a line.

