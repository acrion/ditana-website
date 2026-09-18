---
title: Licensing
description: What the Ditana repository distributes, under which licences, where the corresponding source code is, and why the ZFS packages are packaged the way they are.
---

Almost everything on a Ditana system comes from Arch's own repositories under
Arch's terms. This page is about the packages Ditana builds itself and serves
from `ditana.org` — in particular the ZFS ones, because ZFS on Linux carries a
licence question that a distribution has to answer explicitly rather than by
accident.

It describes what Ditana does and links the primary sources so you can read
them instead of taking this page's word for anything. It is not legal advice.

## The ZFS packages

### What Ditana distributes

| Package | Contents | Licence |
| --- | --- | --- |
| `zfs-utils` | The userspace tools and libraries — `zfs`, `zpool`, `zed`, udev rules, systemd units. | [CDDL-1.0](https://opensource.org/license/cddl-1-0) |
| `zfs-dkms` | Source code only. It unpacks the OpenZFS module sources into `/usr/src/zfs-<version>/` together with a `dkms.conf`. It contains no compiled kernel module. | [CDDL-1.0](https://opensource.org/license/cddl-1-0) |

`zfs.ko`, the kernel module itself, is compiled by DKMS **on your machine**,
against the kernel running on your machine, when `zfs-dkms` is installed and
again after every kernel update. It is never built on a Ditana build host, never
signed by Ditana, and never uploaded anywhere. You can check this on an
installed system:

```bash
pacman -Ql zfs-dkms | grep -c '\.ko$'    # 0
```

### The licence question

[OpenZFS](https://github.com/openzfs/zfs) is licensed under the CDDL. The Linux
kernel is licensed under the GPL version 2. The
[Free Software Foundation](https://www.gnu.org/licenses/license-list.html#CDDL)
lists the CDDL as a free software licence that is incompatible with the GPL, and
the Software Freedom Conservancy reached the same conclusion in its
[2016 analysis](https://sfconservancy.org/blog/2016/feb/25/zfs-and-linux/).
Canonical published the
[opposing position](https://ubuntu.com/blog/zfs-licensing-and-linux) that same
year. The disagreement has never been tested in court and remains unresolved.

What the disagreement is *about* is narrow: whether a **compiled binary that
combines** CDDL-covered OpenZFS code with GPL-covered kernel code may be
distributed. That artefact is `zfs.ko`.

Source code is not such a combination, and neither is userspace: `zfs-utils`
contains no kernel code and is not linked against any. Neither package Ditana
ships is the artefact under dispute.

### Where that leaves Ditana

Ditana distributes the sources and the userspace tools, and lets DKMS build the
module locally. That is the same arrangement
[Debian uses](https://wiki.debian.org/ZFS): a DKMS source package, no prebuilt
modules in the repository.

It is deliberately *not* the arrangement used by projects that ship a
ready-built module — [archzfs](https://github.com/archzfs/archzfs), for example,
offers precompiled `zfs-linux` packages alongside its DKMS variant, and Canonical
ships the module with Ubuntu on the strength of the position linked above. Those
projects distribute the combined binary. Ditana does not, and the choice is the
reason this page exists.

The practical cost of that choice is real and is not hidden: a kernel update on a
Ditana system recompiles the module locally, which takes minutes and needs the
matching kernel headers. This is why the installer offers ZFS only together with
the long-term support kernel: the ZFS entry appears in the File System dialog only while that kernel is selected, and disappears when you pick another one – a non-LTS kernel can move ahead of what OpenZFS supports and leave DKMS unable to build. [How settings depend on each other](/under-the-hood/settings-logic/) shows the two declarations that do this.

The installer states the licence prior to your selection: the File System dialog carries `CDDL` on the ZFS entry, the way package selections carry their SPDX identifier.

## ZFSBootMenu

[ZFSBootMenu](https://github.com/zbm-dev/zfsbootmenu) is the bootloader Ditana
installs on ZFS systems. It is licensed under the MIT licence and contains no
OpenZFS code — it is a set of shell and Perl scripts that call the `zfs` and
`zpool` commands. The question above does not arise for it.

The boot image on your machine is generated locally during installation, by `generate-zbm` operating within the target system, using the components present there. On a UEFI machine it is an EFI bundle located at `/boot/efi/EFI/zbm/`, copied to `/boot/efi/EFI/BOOT/BOOTX64.EFI` as well; on a BIOS machine it is `/boot/syslinux/zfsbootmenu/initramfs-bootmenu.img`.

## Corresponding source code

The CDDL is a file-level copyleft: whoever distributes binaries built from
CDDL-covered files has to make the corresponding source available and keep the
licence notices intact. Ditana distributes `zfs-utils` as a binary package, so
this applies.

For every package in the Ditana repository the recipe is public. Packages taken from the AUR unchanged, and Ditana's forks of them, carry their upstream address in the recipe; Ditana's own packages are built from the repository of the same name under [github.com/acrion](https://github.com/acrion); and the handful taken from Arch's own packaging carry the address of the corresponding repository on gitlab.archlinux.org. The recipe
names the exact upstream archive it fetches and the checksum it is verified
against, which is the corresponding source in the sense the licence means.

For the packages on this page:

| Package | Recipe | Upstream source |
| --- | --- | --- |
| `zfs-utils` | [aur.archlinux.org/packages/zfs-utils](https://aur.archlinux.org/packages/zfs-utils) | [github.com/openzfs/zfs/releases](https://github.com/openzfs/zfs/releases) |
| `zfs-dkms` | [aur.archlinux.org/packages/zfs-dkms](https://aur.archlinux.org/packages/zfs-dkms) | [github.com/openzfs/zfs/releases](https://github.com/openzfs/zfs/releases) |
| `zfsbootmenu` | [aur.archlinux.org/packages/zfsbootmenu](https://aur.archlinux.org/packages/zfsbootmenu) | [github.com/zbm-dev/zfsbootmenu](https://github.com/zbm-dev/zfsbootmenu) |

Ditana's ZFS recipes carry no Ditana patches: the packages are built from the
upstream AUR recipes as published. `pacman -Qi zfs-utils` names the exact
version installed on your machine, and the recipe's AUR history has a commit for
that version. Every run that produced these packages is recorded under
[Build status](/builds/).

The full text of the CDDL-1.0 is at
[opensource.org/license/cddl-1-0](https://opensource.org/license/cddl-1-0) and in
the `COPYRIGHT` and `LICENSE` files of the OpenZFS source tree linked above.

If you cannot locate the corresponding source for any package Ditana
distributes, write to [support@ditana.org](mailto:support@ditana.org) and you
will be pointed at it or sent it.

## Ditana's own code

The installer engine, its knowledge base, and the tooling around them are Ditana's own work:

| Project | Licence |
| --- | --- |
| [ditana-installer](https://github.com/acrion/ditana-installer) | GPL-3.0-or-later |
| [ditana-config](https://github.com/acrion/ditana-config) | AGPL-3.0-or-later |
| [ditana-build](https://github.com/acrion/ditana-build) | AGPL-3.0-or-later |
| [ditana-userns-guard](https://github.com/acrion/ditana-userns-guard) | AGPL-3.0-or-later, except the BPF program itself (`userns_guard.bpf.c`) and the kernel type declarations it needs (`kernel_types.h`), which are GPL-2.0-or-later because the kernel refuses GPL-only helpers to a program that is not |
| [zfs-autosnap](https://github.com/acrion/zfs-autosnap) | AGPL-3.0-or-later |

zfs-autosnap is Ditana's own pre-upgrade snapshot hook, not OpenZFS code; it is installed by default on every ZFS system.

## Not legal advice

This page is written by Ditana's maintainer, not by a lawyer, and it is a
description of Ditana's packaging rather than an opinion on anyone else's. The
CDDL/GPL question is genuinely contested by parties who have taken it seriously,
and every position referenced here is linked so you can read the argument
yourself. If you are redistributing these packages, or building products on top
of them, get your own advice.
