---
title: Download
description: Download the Ditana GNU/Linux ISO with checksum and GPG signature verification.
---

## Ditana GNU/Linux {{release}}

| File                                                            | Purpose                                                                                  |
| --------------------------------------------------------------- | ---------------------------------------------------------------------------------------- |
| [`{{iso}}`](https://ditana.org/downloads/{{iso}})               | The installation image (~{{iso-size}}).                                                  |
| [`{{iso}}.sha256`](https://ditana.org/downloads/{{iso}}.sha256) | SHA-256 checksum. Verifies that your download is intact.                                 |
| [`{{iso}}.sig`](https://ditana.org/downloads/{{iso}}.sig)       | Detached GPG signature. Verifies that the image is genuinely from the Ditana maintainer. |

What changed in this release is described in the [{{release}} release notes]({{notes}}).

Media predating 0.9.4 can no longer install. The installer fetches its configuration upon execution, and that configuration now names packages an older medium’s package repository cannot deliver. Use the image above.

## Verifying your download

### Step 1 — Check the SHA-256 sum

```bash
cd /path/to/your/downloads
sha256sum -c {{iso}}.sha256
```

You should see `./{{iso}}: OK`. If this fails, the file is corrupted in transit – re-download.

### Step 2 — Verify the GPG signature

The ISO is signed with the following key:

```
Stefan Zipproth <s.zipproth@ditana.org>
Fingerprint: 3F80 54C3 FF75 5E55 44E6  8516 BC33 3E9A E877 D45A
```

Fetch the public key from one of the public keyservers:

```bash
gpg --keyserver hkps://keys.openpgp.org --recv-keys 3F8054C3FF755E5544E68516BC333E9AE877D45A
```

Then verify:

```bash
gpg --verify {{iso}}.sig {{iso}}
```

The signature is generated using a signing subkey of that key, so gpg reports the subkey `068E EA2A 490B 0C63 AEAA 3BCD 3EC2 23A8 1107 7C09` on the line preceding the result. That is expected: a subkey may be replaced independently, without the fingerprint you verify against ever changing.

You should see `Good signature from "Stefan Zipproth <s.zipproth@ditana.org>"`. A warning that the key is not certified by a trusted signature is expected — it just means you haven't personally signed the key, which is normal.

The same key is also distributed via the [`ditana-keyring`](https://github.com/acrion/ditana-keyring) repository and pre-installed on every Ditana system, where pacman uses it to verify packages from the Ditana repository.

## Requirements

### Stable internet connection

Depending on what you select, the installer will download substantial amounts of data. Some steps have retry logic, others do not — a stable LAN connection (or a Wi-Fi device you configure during installation) is required.

### Storage requirements

| Configuration | During installation | Installed system |
| ------------- | ------------------- | ---------------- |
| Headless      | 18 GiB              | 5 GiB            |
| Desktop       | 45 GiB              | 13 GiB           |

## Installation procedure

1. **Create a bootable USB stick.** Use [Etcher](https://etcher.balena.io), [Ventoy](https://www.ventoy.net), or `dd` to write the ISO to a USB stick (≥4 GB).

2. **Reboot and enter UEFI/BIOS.** The key varies — `Del`, `F2`, `F12`, or `Esc`, depending on your motherboard.

3. **Disable Secure Boot and Fast Boot.** Both can interfere with the installation. You can re-enable Secure Boot afterwards if you configure your own keys.

4. **Boot from the USB stick.** Select "Ditana GNU/Linux install medium" and press `Enter`.

5. **Troubleshooting (optional).** On some virtualisation platforms (e.g. Synology VMM), the boot can hang before the installer dialogs appear. This is a [known kernel mode-setting issue](https://wiki.archlinux.org/title/Kernel_mode_setting#Disabling_modesetting), unrelated to Ditana. Press `e` at the boot menu, add `nomodeset` at the start of the kernel line, then `Enter`.

6. **Follow the installer.** The dialogs guide you through partitioning, bootloader setup, hardware configuration, and the four desktop environments. Every dialog has a `Help` button with detailed documentation.

## Unattended installation

No individual needs to be present at the keyboard. An answer file supplies what the installer would normally request, and it is delivered to the medium either on a small drive marked `DITANA_AUTO` holding `autoinstall.kdl`, or via `ditana.autoinstall=` in the kernel command line, which also takes a URL. The account password is given as a hash, never in plain text. See the [documentation](https://github.com/acrion/ditana-installer/blob/main/docs/unattended-installation.md) and the [server example](https://github.com/acrion/ditana-installer/blob/main/examples/autoinstall-server.kdl).

## What to do if the installation fails

The installer writes a complete log to `install_ditana.log` (directory varies depending on installation phase). If something goes wrong:

1. Run `/root/folders/usr/lib/ditana/create-debug-user` from the live system and follow the instructions to make the log retrievable.
2. Open an issue on [github.com/acrion/ditana-installer/issues](https://github.com/acrion/ditana-installer/issues) and attach the log, or email it to support@ditana.org.

The installer is conservative — it tries to fail fast and loud rather than continuing in an inconsistent state. Most failures are reproducible and fixable.
