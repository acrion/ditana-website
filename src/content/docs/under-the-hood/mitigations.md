---
title: CPU vulnerability mitigations
description: Per-CPU detection of speculative execution vulnerabilities, kernel parameters Ditana applies by default, and how to verify or override them after installation.
---

Ditana enables CPU vulnerability mitigations in **High Security mode** by default. The installer detects which mitigations your specific CPU needs by reading `/sys/devices/system/cpu/vulnerabilities/`, then offers each as an individually-toggleable checkbox in the **Expert Settings → CPU Vulnerability Mitigation Options** dialog. This page documents every option in detail.

## Default kernel settings vs Ditana's mitigations

The upstream Linux defaults balance security against performance and leave certain vulnerabilities unmitigated unless explicitly opted in. Ditana opts in by default — for most workloads the cost is negligible, while the security benefit is substantial. You can revert any individual mitigation in the installer if you have a workload that demonstrably benefits.

The mitigation logic is hardware-specific. Only the vulnerabilities your CPU actually exhibits are configured; everything else is left at the kernel default.

## After installation

Several mitigations involve disabling Simultaneous Multi-Threading (SMT, also known as Hyper-Threading) as a fallback. Ditana's [custom terminal header](https://github.com/acrion/ditana-print-system-infos) shows which mitigations are active and whether SMT is on or off.

You can also verify with:

```bash
lscpu
```

To compare performance with and without a specific mitigation, edit the kernel command line for a single boot and remove the parameter associated with the mitigation you want to test. On a ZFS installation, which is what the Standard profile produces, that is accomplished via the ZFSBootMenu boot-environment editor; on a system that boots through GRUB, press `e` at the menu. The parameters are listed below under "Applied parameter" for each entry. Reboot and run your real workload – synthetic benchmarks rarely capture real impact.

To make a change permanent on a ZFS installation, set the command line within the boot environment:

```bash
sudo zfs set org.zfsbootmenu:commandline="rw <options>" ditana-root/ROOT
zfs get org.zfsbootmenu:commandline ditana-root/ROOT
```

To make it permanent on a system that launches via GRUB, edit `/etc/default/grub`, find the `GRUB_CMDLINE_LINUX_DEFAULT` line (first save a backup), remove the parameter, then run:

```bash
sudo grub-mkconfig -o /boot/grub/grub.cfg
```

If a change prevents booting, edit the kernel command line in the GRUB menu to recover, then repeat the edit and `grub-mkconfig`.

## Mitigations Ditana enables by default

### Spectre variant 2 — Branch Target Injection

Speculative execution exploit allowing attackers to read sensitive data via mistrained indirect branch predictors. Ditana applies the full mitigation (Indirect Branch Prediction Barrier always-on rather than conditional).

> All Spectre variant 2 mitigations can be forced on at boot time for all programs. This will add overhead as indirect branch speculations for all programs will be restricted.
>
> — [kernel.org: Spectre](https://www.kernel.org/doc/html/latest/admin-guide/hw-vuln/spectre.html)

| | |
|---|---|
| `lscpu` identifier | `Spectre v2` |
| Setting name | *Enforce Spectre Variant 2 Mitigation* |
| Applied parameter | `spectre_v2=on` |

### L1 Terminal Fault (L1TF)

Affects Intel CPUs, allowing unauthorized access to data in the L1 cache. Ditana enforces full mitigation with aggressive cache flushing.

> The kernel does not by default enforce the disabling of SMT, which leaves SMT systems vulnerable when running untrusted guests with EPT enabled.
>
> — [kernel.org: L1TF](https://www.kernel.org/doc/html/latest/admin-guide/hw-vuln/l1tf.html)

| | |
|---|---|
| `lscpu` identifier | `L1tf` |
| Setting name | *Enforce L1 Terminal Fault Mitigation* |
| Applied parameter | `l1tf=full,force` |

### Microarchitectural Data Sampling (MDS)

Allows attackers to sample data from CPU buffers. Full mitigation may disable SMT if necessary.

> The kernel does not by default enforce the disabling of SMT, which leaves SMT systems vulnerable when running untrusted code.
>
> — [kernel.org: MDS](https://www.kernel.org/doc/html/latest/admin-guide/hw-vuln/mds.html)

| | |
|---|---|
| `lscpu` identifier | `Mds` |
| Setting name | *Enforce MDS Mitigation* |
| Applied parameter | `mds=full,nosmt` |

### TSX Asynchronous Abort (TAA)

Affects CPUs with Transactional Synchronization Extensions. Full mitigation may disable SMT if required.

> TSX might be disabled if microcode provides a TSX control MSR. If so, system is not vulnerable.
>
> — [kernel.org: TAA](https://www.kernel.org/doc/html/latest/admin-guide/hw-vuln/tsx_async_abort.html)

| | |
|---|---|
| `lscpu` identifier | `Tsx async abort` |
| Setting name | *Enforce TSX Async Abort Mitigation* |
| Applied parameter | `tsx_async_abort=full,nosmt` |

### Meltdown (L1D flushing)

Speculative execution exploit allowing kernel memory reads from userspace. Ditana forces L1 data cache flushing.

> The kernel command line allows to control the L1D flush mitigations at boot time with the option `l1d_flush=`. By default the mechanism is disabled.
>
> — [kernel.org: L1D flush](https://www.kernel.org/doc/html/latest/admin-guide/hw-vuln/l1d_flush.html)

| | |
|---|---|
| `lscpu` identifier | `Meltdown` |
| Setting name | *Enforce Meltdown Mitigation* |
| Applied parameter | `l1d_flush=on` |

### MMIO Stale Data

Data leakage from memory-mapped I/O. Full mitigation may disable SMT.

> `full,nosmt` — Same as `full`, with SMT disabled on vulnerable CPUs. This is the complete mitigation.
>
> — [kernel.org: MMIO stale data](https://www.kernel.org/doc/html/latest/admin-guide/hw-vuln/processor_mmio_stale_data.html)

| | |
|---|---|
| `lscpu` identifier | `Mmio stale data` |
| Setting name | *Enforce MMIO Stale Data Mitigation* |
| Applied parameter | `mmio_stale_data=full,nosmt` |

### Retbleed — Cross-Thread Return Address Predictions

Speculative execution attack leaking return addresses. Auto-selected mitigation may disable SMT.

> `auto,nosmt` — automatically select a mitigation, disabling SMT if necessary for the full mitigation.
>
> — [kernel.org: kernel parameters](https://www.kernel.org/doc/html/latest/admin-guide/kernel-parameters.html)

| | |
|---|---|
| `lscpu` identifier | `Retbleed` |
| Setting name | *Enforce Retbleed Mitigation* |
| Applied parameter | `retbleed=auto,nosmt` |

See also [kernel.org: Cross-Thread Return Address Predictions](https://www.kernel.org/doc/html/latest/admin-guide/hw-vuln/cross-thread-rsb.html).

### Speculative Return Stack Overflow (SRSO)

Speculative attacks via the return stack buffer. Combines IBPB barriers with strict spectre_v2-user mode.

> `Mitigation: IBPB`: Similar protection as "safe RET" but employs an IBPB barrier on privilege domain crossings (User→Kernel, Guest→Host).
>
> — [kernel.org: SRSO](https://www.kernel.org/doc/html/latest/admin-guide/hw-vuln/srso.html)

| | |
|---|---|
| `lscpu` identifier | `Spec rstack overflow` |
| Setting name | *Enforce SRSO Mitigation* |
| Applied parameter | `spec_rstack_overflow=ibpb spectre_v2_user=on` |

### Gather Data Sampling (GDS)

Affects AVX instructions. Forces microcode mitigation, or disables AVX where microcode is unavailable.

> Specifying `gather_data_sampling=force` will use the microcode mitigation when available or disable AVX on affected systems where the microcode hasn't been updated to include the mitigation.
>
> — [kernel.org: Gather Data Sampling](https://www.kernel.org/doc/html/latest/admin-guide/hw-vuln/gather_data_sampling.html)

| | |
|---|---|
| `lscpu` identifier | `Gather data sampling` |
| Setting name | *Enforce Gather Data Sampling Mitigation* |
| Applied parameter | `gather_data_sampling=force` |

### Register File Data Sampling (RFDS)

Allows sampling of data from CPU registers.

> This parameter overrides the compile time default set by `CONFIG_MITIGATION_RFDS`.
>
> — [kernel.org: kernel parameters](https://www.kernel.org/doc/html/latest/admin-guide/kernel-parameters.html)

| | |
|---|---|
| `lscpu` identifier | `Reg file data sampling` |
| Setting name | *Enforce RFDS Mitigation* |
| Applied parameter | `reg_file_data_sampling=on` |

See also [kernel.org: RFDS](https://www.kernel.org/doc/html/latest/admin-guide/hw-vuln/reg-file-data-sampling.html).

## Vulnerabilities not exposed in the installer

The kernel performs maximum mitigation by default for these — there is nothing for Ditana to add.

Five more are reported by the kernel and named nowhere above, because Ditana adds nothing to them either: Ghostwrite, Indirect Target Selection, old microcode, TSA and VMSCAPE. The kernel decides what each of them needs from the processor it finds and leaves the result where `lscpu` and `/sys/devices/system/cpu/vulnerabilities/` show it.

### Spectre variant 1 — Bounds Check Bypass

> There is no guarantee that all possible attack vectors for Spectre variant 1 are covered.
>
> — [kernel.org: Spectre](https://www.kernel.org/doc/html/latest/admin-guide/hw-vuln/spectre.html)

`lscpu` identifier: `Spectre v1`

### iTLB multihit

`lscpu` identifier: `Itlb multihit`. See [kernel.org: iTLB multihit](https://www.kernel.org/doc/html/latest/admin-guide/hw-vuln/multihit.html).

### SRBDS — Special Register Buffer Data Sampling

`lscpu` identifier: `Srbds`. See [kernel.org: SRBDS](https://www.kernel.org/doc/html/latest/admin-guide/hw-vuln/special-register-buffer-data-sampling.html).

### Speculative Store Bypass (SSB)

> The kernel provides mitigation for such vulnerabilities in various forms.
>
> — [kernel.org: spec_ctrl](https://www.kernel.org/doc/html/latest/userspace-api/spec_ctrl.html)

`lscpu` identifier: `Spec store bypass`.

## Mitigation reduction — at your own risk

The installer also exposes two options that *reduce* mitigations. These significantly increase your exposure to known CPU vulnerabilities. Use only with a clear, justified reason.

### Disable Intel Indirect Branch Tracking — `ibt=off`

Turns off the kernel's Indirect Branch Tracking. IBT is the forward-edge half of Control-flow Enforcement Technology – the hardware checks that every indirect jump or call lands on an `endbr` instruction, which is what makes jump-oriented and call-oriented programming hard. It is control-flow integrity, not a speculative-execution mitigation: Branch Target Injection is Spectre v2, elaborated upon earlier under `spectre_v2=on`. This kernel parameter is **undocumented** in the official kernel parameters reference, even though it is commonly enabled by default on certain distributions without any explicit communication.

The kernel documents the other half of CET, the user-space shadow stack, at [shstk](https://docs.kernel.org/next/x86/shstk.html); IBT itself has no page of its own there.

### Disable all mitigations — `mitigations=off`

This is **stronger than unchecking every individual mitigation** in the dialog. With `mitigations=off`, the kernel skips *every* mitigation it knows about — including the ones Ditana doesn't expose because they're on by default. The performance ceiling rises; the security floor drops, hard.

Only useful for benchmarks, air-gapped systems with full physical control, or environments where you have categorically other defences.

See [kernel.org: kernel parameters](https://www.kernel.org/doc/html/latest/admin-guide/kernel-parameters.html).

## Disclaimer

The guidance here is based on the [official CPU vulnerability documentation](https://www.kernel.org/doc/html/latest/admin-guide/hw-vuln/index.html) and the [kernel command-line parameter reference](https://www.kernel.org/doc/html/latest/admin-guide/kernel-parameters.html). Different kernel branches occasionally diverge from these defaults in subtle ways; our testing covers the Ditana-supported kernels, but unusual hardware combinations can produce edge cases.

If you have a workload that benefits from a different default, or if you find a CPU model where Ditana's detection is incomplete or incorrect: please [open a GitHub issue](https://github.com/acrion/ditana-config/issues) or email support@ditana.org. The detection logic is data, not code — so improvements are usually a few KDL lines.
