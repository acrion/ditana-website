---
title: Hardware detection
description: How Ditana probes your system at install time and adapts configurations transparently, with all detection logic centralized in one auditable file.
---

A traditional installer offers you the same dialogs regardless of whether your laptop has an Intel iGPU or an NVIDIA card; whether you're on bare metal or in a VM; whether your CPU is affected by RETBleed or not. You're expected to know.

Ditana adapts the dialogs to your hardware. Choices you don't need are hidden or pre-filled with safe defaults; choices you do need surface with sensible recommendations.

## The detection principle

All probing that feeds the knowledge base lives in a single file: [`hardware-detection.kdl`](https://github.com/acrion/ditana-config/blob/main/settings/hardware-detection.kdl). Each detector is one line of Raku that runs once at installer startup and exposes a value – usually a boolean – to the rest of the knowledge base. Probing that needs more than a line lives in the installer engine: the graphics card is matched against the lists NVIDIA publishes, and the NVMe block format, rotational media and the EFI partition are found there too.

A few representative examples from the live file:

```
- name="uefi" \
  detect="'/sys/firmware/efi'.IO.e"

- name="intel-cpu" \
  detect="'/proc/cpuinfo'.IO.lines.first(* ~~ /vendor_id/).contains('GenuineIntel')"

- name="virtual-environment" \
  detect="run('systemd-detect-virt', '-q').exitcode eq 0"

- name="is-retbleed-vulnerable" \
  detect="given '/sys/devices/system/cpu/vulnerabilities/retbleed'.IO
            { .e && .slurp.chomp ne 'Not affected' }"
```

Each one reads from `/sys/`, `/proc/`, or shells out to a standard tool — no proprietary hardware abstraction layer, no opaque database. If you want to know *what* Ditana detects and *how*, the answer fits on one screen and you don't need to leave the file.

## From detection to decision

Detectors don't act on their own. They expose values that other settings reference in their `default-value` or `available` expressions. The chain is always: **detect → decide → install**.

A clean example is CPU vulnerability mitigation. Each kernel-reported vulnerability (Spectre v2, Meltdown, MDS, TAA, MMIO Stale Data, L1TF, RETBleed, SRSO, GDS, RFDS) has its own detector. The corresponding mitigation setting then references that detector as its default:

```
- name="kernel-option-retbl" \
  dialog-name="CPU Vulnerability Mitigation Options" \
  short-description="Enforce Retbleed Mitigation (retbleed=auto,nosmt)" \
  default-value="`is-retbleed-vulnerable`"
```

If your CPU isn't affected, the checkbox starts unchecked. If it is, it starts checked. Nothing is filtered by CPU: every mitigation is listed either way, so you can also see what your CPU was found not to need. The one thing that does remove them from the dialog is choosing `mitigations=off`, which makes each of them pointless — see [how settings depend on each other](/under-the-hood/settings-logic/). See the [CPU mitigations page](/under-the-hood/mitigations/) for the full per-vulnerability rationale.

## Case study: Wayland compatibility

Some detection requires less obvious sources. Modern Wayland compositors like Niri strictly need 3D hardware acceleration — software rendering (llvmpipe, softpipe) is not enough; the compositor will crash or refuse to start.

Rather than guess from the GPU vendor, Ditana asks the kernel which DRM driver is actually active for the rendering device:

```
- name="has-wayland-compatible-gpu" \
  detect="given dir('/sys/class/drm').grep(*.basename.starts-with('renderD')).first
            { $_ ?? ($_ ~ '/device/driver').IO.resolve.basename
                    ~~ any(<amdgpu radeon i915 xe nvidia nouveau virtio-pci virtio_gpu>)
                  !! False }"
```

If your system's driver isn't on this list — `vmwgfx` in VMware, `hyperv_fb` in Hyper-V, `bochs-drm` in some QEMU setups — `has-wayland-compatible-gpu` evaluates to `False`. The Niri option disappears from the desktop-environment selection, and Ghostty (which needs OpenGL 4.3+, unavailable to software rasterizers) becomes unavailable:

```
- name="install-ghostty" \
  available="`install-desktop-environment AND has-wayland-compatible-gpu`"
```

One detector, multiple consumers. Adding a hardware-gated option later is usually a single change in the consumer's `available` field — no detection logic needs to be touched.
