---
title: '"invalid or corrupted package (PGP signature)"'
description: 'What should be done when pacman refuses a package due to its inability to validate the signature, and how to manually verify Ditana''s signing key yourself.'
---

Every package Ditana ships is signed, and pacman refuses to install one whose
signature it cannot check. That is the mechanism working. But it also means a
keyring that is out of date locks you out of the very updates that would fix it.

You will see one of these, depending on whether the signing key is missing from
your keyring or present but not trusted:

```text
error: ditana-mirrorlist: key "3EC223A811077C09" is unknown
:: Import PGP key 3EC223A811077C09? [Y/n]
error: 'ditana-mirrorlist-1.12-1-any.pkg.tar.zst': invalid or corrupted package (PGP signature)
```

```text
error: ditana-mirrorlist: signature from "Stefan Zipproth <s.zipproth@ditana.org>" is unknown trust
error: failed to commit transaction (invalid or corrupted package (PGP signature))
```

## The repair

For a Ditana package:

```sh
sudo pacman -Sy ditana-keyring
```

For an Arch package (the same problem, the same shape — this one is common on
systems that have been offline for months):

```sh
sudo pacman -Sy archlinux-keyring
```

This is the exception to the "never `-Sy` a single package" rule from [Updating is not optional](/troubleshooting/updating/), and it
is worth understanding *why* it is safe rather than treating it as a magic
incantation. Only one package is in the transaction, so there is no partial
upgrade of a dependency graph. That package is small and contains no
executables. And its signature is verifiable with a key your installation
already has, so nothing is being trusted that was not trusted before —
installing it runs `pacman-key --populate`, which adds the current set of
Ditana keys to your keyring. Afterwards, run a **full** update as usual.

If you would rather do it by hand, this is exactly what the package's install
script runs:

```sh
sudo pacman-key --populate ditana
```

## Verify the keys yourself

Ditana packages are signed by this key:

```text
pub   rsa4096  3F80 54C3 FF75 5E55 44E6  8516 BC33 3E9A E877 D45A
uid   Stefan Zipproth <s.zipproth@ditana.org>
uid   Stefan Zipproth <support@ditana.org>
```

It carries a dedicated signing subkey, and that subkey is what signs the repository database and every package built since August 2026:

```text
sub   rsa4096  068E EA2A 490B 0C63 AEAA  3BCD 3EC2 23A8 1107 7C09
```

The fingerprint you verify against stays the one above: a subkey can be replaced without it changing. A keyring pre-dating `ditana-keyring 20260809` does not know the subkey at all, which is exactly the situation the repair above addresses.

Check what your own system trusts with:

```sh
pacman-key --list-sigs ditana
gpg --show-keys --with-subkey-fingerprint /usr/share/pacman/keyrings/ditana.gpg
```

We deliberately do **not** offer a download-and-run repair script here. The
situation you are in is "my signature verification is failing"; answering that
with "download this and execute it as root" is formally the same operation the
signatures exist to prevent, and the script could not be meaningfully signed
either — the signature check is the broken part. One command you can read is
better than a black box.

## Other causes of the same message

- **The clock is wrong.** A signature is not valid before it was made. If the
  system clock is far in the past — a drained CMOS battery, a fresh VM, a dual
  boot with Windows writing local time to the RTC — every signature looks like
  it is from the future. Check with `timedatectl` and enable NTP with
  `sudo timedatectl set-ntp true`.
- **A mirror served a truncated file.** The message mentions a checksum rather
  than a PGP signature in that case. `sudo pacman -Scc` clears the download
  cache and retries.

