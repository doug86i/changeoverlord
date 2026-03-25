# Soundcraft — Si (Impact · Expression · Performer · Compact)

**Status:** Plan / research notes. **Scope:** **HiQNet** (or Harman-approved remote stack) for **channel strip naming**. Other ViSi Remote features **out of scope**.

Driver **client-side** ([`README.md`](README.md)).

---

## Official / vendor positioning

| Resource | URL |
|----------|-----|
| **ViSi Remote** | [soundcraft.com — ViSi Remote](https://www.soundcraft.com/en-US/products/ViSi-Remote) | States iPad control for **Si Performer, Expression, Compact** and **Vi** over **HiQnet port** via venue Wi‑Fi router. **Not** a protocol dump. |

---

## Third-party HiQNet structure (unofficial)

| Source | URL |
|--------|-----|
| **HiQontrol HiQNet documentation** | [hiqontrol.readthedocs.io](https://hiqontrol.readthedocs.io/en/latest/hiqnetproto.html) | Same **“Channels names”** virtual device (`1.0.0.44`) discussion as **Vi** notes—**do not assume** Si uses identical **VD / PID** layout without capture. |

Si and Vi **differ** in software generation; COL should treat **Si** as its **own** spike even if stacks look similar.

---

## Smaller Soundcraft note

The **Soundcraft Ui** series uses a **different** (JSON-style) unofficial API ([soundcraft-ui](https://github.com/fmalcher/soundcraft-ui))—**not** this document.

---

## Open points

1. Lab: rename **CH1** on Si Expression → log **HiQNet** parameter writes (if visible).  
2. Determine whether **offline** Si presets store names in the same VD—may help build tests without hardware.  
3. Decide minimum firmware version (Si firmware 2.x vs 3.x differences).
