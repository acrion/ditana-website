---
title: 'An update broke something'
description: 'Four steps to discover what an update changed and to get a functioning system back.'
---

1. **Check whether it is us.** The [build status page](/builds/) shows every
   package build, including the ones that were held back. If the last run was
   held back, the repository has not changed since the one before it, and the
   cause is elsewhere.
2. **Boot the snapshot.** With automatic snapshots enabled, the pre-update state
   is a boot menu entry away. This is the fastest way to get a working system
   back, and it costs nothing to try.
3. **Check what actually changed.** `/var/log/pacman.log` lists every upgraded
   package with a timestamp, so you can narrow the search to what moved.
4. **Read the news.** Arch announces every change that needs manual
   intervention at [archlinux.org/news](https://archlinux.org/news/). If an
   update needed a step you did not take, it is usually there.

