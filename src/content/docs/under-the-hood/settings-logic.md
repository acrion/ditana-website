---
title: How settings depend on each other
description: The two expression fields in Ditana's knowledge base — one keeps an option out of reach, the other moves its value, and most relationships need both.
---

Two fields in the knowledge base contain logic instead of data, and they respond to two different questions. Confusing them is the mistake this page exists to prevent.

`available` decides whether a setting is a row the user can reach at all. `default-value` decides what it is set to – not once, but every time something its expression names changes.

## An option that cannot be chosen

A setting whose `available` expression is false is not rendered. The dialog is built from the settings that are available, so the row is simply not there, and the instruction above the list gains a note saying how many settings are missing and where to read about them.

It does not vanish without a trace. The help text of the dialog lists every unavailable setting of that dialog under a heading of its own, with its full description and one line more, in which the expression is that setting’s own `available` condition with the backticks taken off:

```text
=== Condition of availability: === <the expression>
```

Losing availability does not in itself mean losing the value. The engine switches an unavailable setting off in exactly one place: when the user confirms a dialog, across the rows of that dialog, for a setting whose availability the user has just removed via their own change in that dialog. A setting that becomes unavailable due to something the user did in a different dialog keeps whatever value it previously held, and it is no longer present as a row anywhere, so nothing there will interact with it again.

That is what the second field is for, and it is why the two are so often used together.

## An option that follows another

A `default-value` might be an expression, and such an expression is not a fallback. Whenever a setting it names changes, the engine re-evaluates it and applies the result – over a value the user chose by hand, if that is what the expression now says. The engine keeps no record of who set a value, so there is nothing for it to defer to. Only a literal `default-value` behaves as a starting value and is then left alone.

The result travels: applying it may change a setting a third expression names, which is evaluated in turn. Nothing in the engine knows about any particular setting; the whole chain is in the data.

## The file system dialog, in full

ZFS needs DKMS, and DKMS on a kernel that has progressed beyond what OpenZFS supports cannot build. Ditana therefore pairs ZFS with the long-term support kernel, and it takes both fields to do it:

```kdl
- name="zfs-filesystem" \
  available="`install-standard-lts-kernel`" \
  default-value="`install-standard-lts-kernel AND NOT profile-quick`" {
    // ...
  }
```

The `available` line is the gate. Choosing a different kernel does not move ZFS onto the LTS kernel and does not leave ZFS running on a kernel it cannot build against: the ZFS row is gone from the file system dialog, and the pairing holds because the unpaired state is not one the user can select.

For that setting the help says, in the file system dialog of an installation that is not on the long-term support kernel:

```text
=== Condition of availability: === install-standard-lts-kernel
```

The `default-value` line is what makes the gate bite from another dialog. The kernel is chosen in the Kernel Selection dialog, where ZFS is not a row, so the rule that switches an unavailable setting off never reaches it. Naming the same condition in `default-value` is what turns ZFS off – and it is why forty-five settings in the knowledge base carry an expression in both fields. The two are not alternatives.

```kdl
- name="btrfs-filesystem" \
  default-value="`profile-quick OR NOT install-standard-lts-kernel`" {
    arch-packages "btrfs-progs" "compsize"
  }
```

Btrfs is the default of the file system dialog whenever the Quick Installation profile is chosen or the LTS kernel is not selected. The two expressions are complementary halves of the same condition, so exactly one file system is chosen at any moment. A user who switches the kernel away from LTS therefore finds, on returning to the file system dialog, that the ZFS row is gone, that Btrfs is chosen, and that the note above the list points at the help, where the condition that removed ZFS is printed out.

The LTS kernel starts as the default, so in a standard setup nothing here appears: ZFS is offered, and choosing it changes no kernel since the kernel is already right.

## What this means for a contribution

The two fields answer two questions, and a relationship typically needs both answered. Does the option make sense at all under this condition – that is `available`, and it removes the row. Should the option follow this condition – that is `default-value`, and it moves the value, from any dialog. A gate whose condition is decided in the same dialog can do with `available` alone; a gate whose condition lives elsewhere cannot, and that is the common case.
