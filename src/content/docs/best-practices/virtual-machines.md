---
title: Virtual machines
description: Recommended hypervisors for testing Ditana, and how they interact with modern Wayland compositors.
---

If you want to install and test Ditana inside a virtual machine, your choice of virtualization software will heavily influence your experience.

Ditana ships with four modern desktop environments (XFCE, Wayfire, Niri, and COSMIC). Wayland compositors like Wayfire, Niri, and COSMIC are built around modern 3D hardware acceleration. Consequently, they require a virtual machine capable of passing 3D graphics instructions through to your host system.

## Recommended: QEMU / KVM / UTM

Hypervisors based on **KVM** (Linux) or Apple's Hypervisor framework (macOS) expose a modern, highly capable virtual graphics card known as `virtio-gpu`.

* **Examples:** GNOME Boxes, virt-manager (Linux), UTM on an Intel Mac. On Apple Silicon, UTM can accelerate only an ARM64 guest, and Ditana publishes an x86_64 image; it runs there under emulation, without a path to the host GPU.
* **Support:** **Full.**
* **What works:** XFCE, Wayfire and Niri are available and operate seamlessly, provided you enable 3D acceleration (`virgl` or `Venus`) in your VM's display settings. COSMIC also functions, but via software rendering: it is pinned to `llvmpipe` in every virtual machine, deliberately, to avoid glitches in its GPU backend. Undo that by removing the exports from its login commands if your setup can drive it.

## Not recommended: VirtualBox & VMware

VirtualBox and VMware rely on older, legacy-style virtual graphics drivers (`vmwgfx`). While they offer a "3D Acceleration" checkbox in their settings, their architecture lacks the modern Linux graphics stack features (like full GBM support) required by demanding Wayland compositors.

* **Support:** **Fallback mode.**
* **What happens:** Ditana checks which DRM driver the kernel has actually bound to the render node. `vmwgfx` and the other drivers these hypervisors present are not Wayland-capable, so Wayfire receives a CPU-rendering fallback – a check that keys on the driver rather than on the hypervisor, and therefore also applies on bare metal with an unlisted driver. COSMIC is pinned to software rendering in every virtual machine, regardless of the driver.
* **Limitations:** Animations may be less smooth, as your CPU is doing the work of a graphics card. Furthermore, the **Niri desktop environment will be hidden** from the installer, as it strictly refuses to launch without proper native 3D hardware.

If you must use VirtualBox or VMware, the traditional **XFCE (X11)** desktop environment remains a very fast and reliable choice.

*(For technical details on how the installer identifies your hardware and decides what to install, see [Hardware detection](/under-the-hood/hardware-detection/)).*

## What else changes in a virtual machine

Ditana has one more point to say in a virtual machine, and it is not only about Niri. The same check that hides Niri also removes Ghostty from the terminal emulator list, because Ghostty needs OpenGL 4.3; kitty stays, needing only 3.3. In a VirtualBox guest the Guest Additions are offered under Hardware Support Options, which is what brings the shared clipboard and the automatic window resizing.
