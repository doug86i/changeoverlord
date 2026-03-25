# Midas — Pro series (Pro1 / Pro2 / Pro6 / Pro9 etc.)

**Status:** Plan / research notes. **Scope:** **LAN connection** + **input strip naming** (channel / scribble labels) via the Midas Pro “pro-series” OSC control path. Full mixing control is out of scope.

COL driver runs **client-side** (operator machine).

---

## Core source (OSC endpoints)

Community-maintained documentation for “Midas Pro series OSC”:

- [muffeeee/midas-pro-series-osc-commands](https://github.com/muffeeee/midas-pro-series-osc-commands)

This repo reverse-engineered and brute-forced a set of working OSC parameter nodes and records them in:

- `pro-series-endpoints.json` (OSC command tree + argument types)
- `Pro2 OSC Commands` (human-readable command paths)

**Important:** this is *not* an official vendor spec; treat it as a “best known wiring” that must be validated against your exact model/firmware in a lab.

---

## Transport and connection

Per the repo’s README, COL needs to:

1. **Set an IP** on the pro mixer
2. **Enable ethernet control** in the console’s settings

The repo does **not** (in its README) specify the exact UDP port number for the OSC service. So for the driver implementation, the correct port must be:

- confirmed from your console manual / setup screen, or
- measured from a session while the console sends/receives OSC traffic.

Use a non-destructive spike and document the result in this file before coding.

---

## Naming: input strip / channel labels (OSC)

From `pro-series-endpoints.json` (via the Pro2 OSC command path listing), the **channel name string nodes** are exposed as `enPPCStringMessage` values under:

- `/enPPCStringMessage/enGlobals/enInputNameListN`

Where:

- `N` is an input-name list index present in the endpoint map (the extracted listing includes `N = 1..24`).
- The argument type is `verified_string` (string payload).

### Practical mapping rule (must validate)

Treat `N` as “input channel label slot” for the mixer family in question. For COL’s driver you should:

- query/verify the console’s actual label count,
- map `N` to the console’s actual “input 1..M” ordering for that model,
- then apply `names[i]` from COL to the correct `N` for each strip.

Do **not** assume `N` equals console channel number without verifying against one or two channels.

### Write-only safety boundary

Only set those `/enPPCStringMessage/enGlobals/enInputNameListN` nodes for the naming operation.
Avoid using adjacent OSC nodes in the same envelope that control routing/mutes/EQ/sends.

---

## Open points for a spike

1. Confirm **exact UDP port** for the pro mixer OSC receive endpoint (console settings/manual; do not guess).
2. Confirm how many `enInputNameListN` entries actually exist on the chosen model (e.g. Pro2c vs other variants).
3. Confirm mapping from `N` to console “input strip numbers” (1-based vs ordering quirks).
4. Check whether a keepalive/remote session handshake is required (the repo README does not mention it in a way we can cite).

---

## Links

- Repo README: https://github.com/muffeeee/midas-pro-series-osc-commands#readme
- Endpoint tree: `pro-series-endpoints.json` (in the same repo)

