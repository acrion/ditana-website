---
title: Configuration as data
description: How Ditana separates its installer engine from its configuration knowledge base to ship improvements instantly, audit decisions transparently, and accept contributions without touching code.
---

When an Arch update on a Tuesday morning requires a new workaround for a specific Intel iGPU — what does a traditional installer do? Nothing, until somebody patches the bash script that drives it, releases a new ISO (1–3 GB), and waits for users to download it. Days at best, weeks more commonly.

Ditana takes a fundamentally different approach: **configuration as data.**

## Three separate pieces

Ditana's architecture is split into three repositories:

1. **The Engine** ([`ditana-installer`](https://github.com/acrion/ditana-installer)) — a small, generic program that knows *how* to draw dialogs, partition disks, detect hardware, and run `pacstrap`.
2. **The Knowledge Base** ([`ditana-config`](https://github.com/acrion/ditana-config)) — a structured database written in [KDL v2](https://kdl.dev). It declares every setting, every hardware quirk, every package dependency, every lifecycle script, and the logical relationships between them.

3. **The Package Pipeline** ([`ditana-build`](https://github.com/acrion/ditana-build)) – what builds the packages the knowledge base names. Ditana's repository stands upon Arch's, and the recipes in it are rebuilt from source, reviewed and signed by that pipeline rather than taken as they come.

When you boot the Ditana ISO, the engine connects to GitHub and downloads the latest release of the knowledge base (falling back to an offline snapshot bundled with the ISO if you have no internet connection).

What the runtime fetch does not cover is worth knowing too. The engine itself and the converter it reads KDL with are on the medium and change only with a new one. And the channel carries a mistake as readily as a fix: a configuration that names a package the repository of an older medium cannot serve makes that medium unable to install, which is exactly what happened when Arch withdrew `bubblewrap-suid` in September 2026.

## Why this matters

Three benefits, in order of immediate impact:

- **Zero-respin updates.** If a user reports that a recent Arch update requires a new workaround, the fix lands in `ditana-config` as a small KDL edit. The very next person who boots a Ditana ISO downloads the updated logic automatically. The fix reaches users immediately, without anyone needing to download a new ISO.
- **Transparent reasoning.** Because settings are declared as structured data with explicit conditions, the rules are auditable end-to-end. Anyone can read the KDL files and see exactly *why* a package is installed, *what* combination of settings triggers a configuration file to be deployed, or *which* hardware property gates an option. No bash detective work.
- **Forkable contributions.** Adding a hardware workaround, a new desktop tweak, or a new packaging choice typically involves modifying a single KDL file. No installer engine modifications – and outside hardware detectors, which are one-line Raku expressions, no Raku at all. The `ditana-config` README walks contributors through the schema; most pull requests touch one file.

## Why KDL, not JSON or YAML

The knowledge base could have been any structured format. KDL was chosen because it has the properties Ditana's configuration actually needs:

- **Native comments.** YAML and JSON both struggle here — YAML has comments but tooling support is uneven; JSON has none at all. Ditana's settings include extensive rationale comments explaining *why* a default is what it is. Those comments are the point.
- **Raw strings.** Embedded shell snippets, sed expressions, and regex patterns are first-class. No double-escaping `"` and `\` to satisfy the parser.
- **Hierarchical without ceremony.** Children, properties, and arguments coexist cleanly. The same node can describe a setting *and* contain sub-nodes for its packages, scripts, and files.
- **Diff-friendly.** Insertion order is preserved. A code review of a one-line addition shows a one-line diff, not a reordered structure.

The format is parsed by a small Rust converter (`json-kdl-converter`, also versioned alongside the schema) before the Raku installer consumes it as JSON. The next section explains how the data is validated end-to-end before any of that.

## What this looks like in practice

A complete, working setting in `ditana-config` looks like this:

```kdl
// XFCE fallback for Wayland-only primary terminals (foot, cosmic-term).
// Fires when the user picks a Wayland-native terminal AND also installs
// XFCE. Writes to xfce-xdg-terminals.list only; xdg-terminals.list still
// points at the primary terminal for Wayland sessions.
- name="fallback-kitty-for-xfce" \
  default-value="`(install-foot OR install-cosmic-term) AND install-xfce`" {
    arch-packages "kitty" \
                  "imagemagick" \
                  "python-pygments" \
                  "libcanberra" \
                  "xdg-terminal-exec-git"
    files "/etc/xdg/kitty/kitty.conf" \
          "/usr/share/pixmaps/ditana-logo-tiny.png"
    chroot-script "mkdir -p /etc/xdg" \
                  "echo kitty.desktop >/etc/xdg/xfce-xdg-terminals.list"
}
```

That node declares a derived setting with no dialog of its own, a logical expression over three other settings, the packages to install when it holds, and the file that makes XFCE use them. The reasoning stands next to the rule, where someone reviewing it can see why. The full schema documentation is in the [`ditana-config` README](https://github.com/acrion/ditana-config#readme).

The same shape carries things that are not packages at all. A program that needs an unprivileged user namespace for its sandbox says so beside itself:

```kdl
- name="flatpak" default-value=#true {
    arch-packages "flatpak"
    // Every Flatpak, not only the browsers, runs bwrap to build its outer
    // sandbox, and bwrap needs a user namespace. This is the declaration
    // that buys it one.
    userns-allow "/usr/bin/bwrap"
  }
```

Ditana does not hand unprivileged user namespaces to each program. A minimal BPF program, [`ditana-userns-guard`](https://github.com/acrion/ditana-userns-guard), is attached to the kernel's own `userns_create` hook and refuses a namespace to any executable that a setting has not requested. A hook of that kind can only refuse and never grant, which is why the sysctl that switches namespaces off is raised only once the program is loaded – a machine that cannot load it keeps them off entirely. This is the default state of a System Hardening option; switch it off and namespaces are open to everything, as they are on most distributions.

Ditana refuses user namespaces to everything that has not asked. What makes that workable is that the request is local: it is written where the package is chosen, so nothing needs to keep a synchronized central list, and switching the setting off takes the permission with it. The installer collects the declarations of the settings that ultimately remain enabled and generates the allowlist from those.

## Validation: catching mistakes before they ship

A knowledge base this large needs guardrails. Every commit — both locally via [pre-commit hooks](https://pre-commit.com) and remotely on GitHub Actions — runs a layered validation pipeline that catches the mistakes a human reviewer might miss:

- **KDL syntax** (`kdlfmt`) — the file parses at all.
- **Schema validation** ([`ditana-schema.json`](https://github.com/acrion/ditana-config/blob/main/ditana-schema.json)) — every field has the right type, no unknown properties, no missing required fields. Catches typos in field names like `arc-packages` instead of `arch-packages`.
- **File reference integrity** — every file referenced from a setting actually exists in `folders/`; conversely, every file in `folders/` is referenced by at least one setting. Orphans get flagged. Directory references (which would silently do nothing because the installer uses `cp` without `-R`) are rejected.
- **Lifecycle correctness** — `chroot-script` lines that touch `/etc/skel/` are rejected, because the user is created *after* `chroot-script` runs — the correct field is `early-chroot-script`. A subtle bug that would otherwise produce a system where the new user's home doesn't have the expected files.
- **Shell script validity** – every shell snippet in any of the script-list fields gets `bash -n` for syntax and [`shellcheck`](https://www.shellcheck.net) for quality. A missing quote or a `[ "$x" = $y ]` style bug is detected at commit time, not at first install.
- **Declared permissions and kernel settings** – a `userns-allow` entry must be an absolute path, and a `sysctl` entry must name something that is a sysctl key and give it a value the kernel will take. Both fields were added in 0.9.4 and are declared in [`ditana-schema.json`](https://github.com/acrion/ditana-config/blob/main/ditana-schema.json).
- **Contradicting kernel settings** – two settings that write the same sysctl key with different values stop the installation, and the message names both of them. Assembled as shell text, as it was before 0.9.4, the last line written simply won and nobody was told.
- **Logical expression integrity** — backticks must balance; every setting name referenced in a `default-value` or `available` expression must actually exist somewhere in the knowledge base. A typo like `install-cosmik` instead of `install-cosmic` gets caught at commit time instead of producing a silent runtime crash.

The full check runs in seconds locally with `pre-commit run --all-files`, and again on every push to GitHub. Local green means CI green; broken commits never make it to a release.

## Where to go next

- Read [how settings depend on each other](/under-the-hood/settings-logic/) — `available` and `default-value` are where the logic of the knowledge base lives.
- [Browse the `ditana-config` repository](https://github.com/acrion/ditana-config) to see how the rules are organised by dialog and topic.
- Read the [`ditana-config` README](https://github.com/acrion/ditana-config#readme) for the data model: how settings, scripts, dialogs and files relate.
- Look at the [`ditana-installer` source](https://github.com/acrion/ditana-installer) if you want to see the engine that reads and acts on the configuration.
