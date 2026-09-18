---
title: Under the hood
description: Architecture, security concepts, and the inner workings of the Ditana installer.
---

Ditana makes a lot of decisions automatically during installation — from resolving package conflicts to applying CPU-specific mitigations.

This section explains the architecture behind those decisions. You do not need to read this to use Ditana daily. However, if you want to understand our "Configuration as data" philosophy, learn how the system probes hardware, or intend to contribute to the installer, this is the place to start.

## Available pages

- [**Configuration as data**](/under-the-hood/configuration-as-data/) — why Ditana separates the installer engine from its knowledge base, and how updates ship without re-spinning an ISO.
- [**Hardware detection**](/under-the-hood/hardware-detection/) — how the installer dynamically probes your hardware at boot time using KDL rules.
- [**How settings depend on each other**](/under-the-hood/settings-logic/) – the two expression fields in the knowledge base: one keeps an option out of reach, the other moves its value, and most relationships need both.
- [**CPU mitigations**](/under-the-hood/mitigations/) — detailed documentation on per-CPU vulnerability detection, default kernel parameters, and how to override them.
