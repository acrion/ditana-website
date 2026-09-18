---
title: Automatic system snapshots
description: How Ditana configures atomic snapshots around system upgrades, and how to roll back from the rescue system.
---

Ditana takes an automatic snapshot of the system state prior to a system upgrade, through a pacman hook. This is configured independently of the chosen filesystem under **Advanced Settings → System Maintenance Tools → Configure Automatic System Snapshots** in the installer (enabled by default).

How frequently that occurs varies. On **ZFS** each upgrade is preceded by a snapshot. On **BTRFS**, **XFS** and **EXT4**, `timeshift-autosnap` takes at most one snapshot every 18 hours (`minHoursBetweenSnapshots` in `/etc/timeshift-autosnap.conf`), so a second upgrade on the same day does not trigger a new one. Either way, three are kept (`maxSnapshots`).

On **ZFS** and **BTRFS**, snapshots are atomic — captured at a single instant, with negligible storage and time overhead. On **XFS** and **EXT4**, Timeshift is used in rsync mode; the initial snapshot is the slowest one, and subsequent snapshots typically complete in under five seconds.

The installer itself captures the first snapshot, just prior to the first reboot, ensuring there is a clean baseline from day one – you can roll back to "freshly installed" without having ever done an upgrade first. On ZFS that baseline does not last: it is named like every other automatic snapshot and is the oldest, so the retention limit sweeps it up after three upgrades. Rename it, or raise `maxSnapshots`, if you want to keep it. Under Timeshift it survives, because the deletion filter does not match it.

**Snapshots are system-only.** Your home directory and other data volumes are not included. Restoring a system snapshot does not touch your personal files — roll back the system, keep your work.

### Edge case: rolling back to the installer's snapshot

If you roll back to the very first snapshot taken at the end of installation, one minor consequence: the first-boot Flatpak deployment service (`ditana-flatpak-finalize.service`) will run again during the next boot, reinstalling the Flatpaks you initially chose. It is scheduled prior to the login screen and intentionally delays it while it downloads, so a boot that sits on a text console for a while is the expected behaviour and not a hang. This is by design – those Flatpaks are part of the configured system, so they are reinstated alongside everything else. Subsequent rollbacks (to snapshots after first-boot completion) do not exhibit this.

### ZFS lock file handling

Ditana ships its own [zfs-autosnap](https://github.com/acrion/zfs-autosnap) fork, which moves the pacman lock file (`/var/lib/pacman/db.lck`) aside at the moment the snapshot is taken and puts it back afterwards, so that the snapshot contains no lock file. This means a ZFS rollback leaves you with a usable pacman immediately — no manual `rm /var/lib/pacman/db.lck` step. The upstream Timeshift variant for non-ZFS filesystems does not handle this, which is why the Timeshift recovery procedure below includes that manual step.

## Recovery procedure

On ZFS there is a shorter route that needs no medium at all. ZFSBootMenu can boot a snapshot directly: interrupt it at startup, pick the boot environment, and choose the snapshot you want from the list it shows. The installer's own baseline is called `autosnap_after_ditana_installation`. Everything below is for the case where that is not enough, or for a filesystem other than ZFS.

If your system fails to boot, boot from the Ditana ISO. It asks whether it should enter the rescue system for the installation it discovered; respond with yes, and it mounts the installed system and lists the snapshots it holds. The commands below are what you run inside that rescue system – not in the bare live environment, which has neither Timeshift nor the imported pool.

### ZFS

List available snapshots:

```bash
zfs list -t snapshot
```

Example output:

```
NAME                                                    USED  AVAIL  REFER  MOUNTPOINT
ditana-root/ROOT/default@autosnap_2026-05-19_23-14-41   453K      -  3.96G  -
ditana-root/ROOT/default@autosnap_2026-05-19_23-25-28   394K      -  3.96G  -
ditana-root/ROOT/default@autosnap_2026-05-19_23-26-06  1.05M      -  3.96G  -
```

Restore a specific snapshot:

```bash
sudo zfs rollback ditana-root/ROOT/default@autosnap_2026-05-19_23-26-06
```

`zfs rollback` refuses while newer snapshots exist, which is the normal case once several have accumulated. Destroy them first, or pass `-r` to have it destroy them for you – everything newer than the snapshot you are restoring is gone either way.

### BTRFS, XFS, EXT4

Automatic snapshots are managed by `timeshift-autosnap`, which creates a snapshot before every full upgrade.

List available snapshots:

```bash
sudo timeshift --list
```

Example output:

```
Mounted '/dev/dm-0 (sda4)' at '/run/timeshift/195216/backup'
Device : /dev/dm-0 (sda4)
Mode   : RSYNC

Num Name                Tags  Description
------------------------------------------
0 > 2026-05-19_18-04-37 0     after installation of Ditana GNU/Linux
```

Restore a snapshot:

```bash
sudo timeshift --restore --snapshot 2026-05-19_18-04-37
```

When prompted, **do not reinstall GRUB2** as Timeshift recommends — it assumes the presence of an `update-grub` tool that Ditana does not use. If you need to update GRUB after restoration, run:

```bash
grub-mkconfig -o /boot/grub/grub.cfg
```

After a Timeshift restore, also clear the pacman database lock:

```bash
sudo rm /var/lib/pacman/db.lck
```

This is required because `timeshift-autosnap` (the upstream project for non-ZFS filesystems) captures the pacman lock file as part of the snapshot. Ditana's [zfs-autosnap fork](https://github.com/acrion/zfs-autosnap) removes the lock file before snapshotting, which is why the equivalent step is unnecessary on ZFS (`zfs rollback` is sufficient).
