# Avid — VENUE \| S6L

**Status:** Plan / research notes. **Scope:** **Ethernet** control plane (ECx / show network) — specifically whether **OSC** or **VENUE Show Control** mechanisms can set **channel / track strip names** from outside. **EUCON** is Avid’s control protocol for **surfaces ↔ Pro Tools family**; do not confuse with **console ↔ FoH utility** unless documentation says otherwise.

Driver **client-side** ([`README.md`](README.md)).

---

## Official Avid documentation hubs

| Resource | URL |
|----------|-----|
| **S6L documentation index** (handbooks, system guides — verify latest **v8.x** PDFs) | [S6L Documentation (Avid KB portal)](https://avidtech.my.salesforce-sites.com/pkb/articles/en_US/Knowledge/S6L-Documentation) |
| **VENUE SNAP — Sample OSC and MSC Command Files** (related ecosystem) | Search Avid KB for *VENUE SNAP OSC* — Avid publishes **example command files** for show control integrations. |

**COL must** pull the exact **OSC receive** capabilities for **strip naming** from the **current System / Event Triggers / External Control** manual for the customer’s **VENUE software** version.

---

## Third-party write-ups (OSC on ECx / AVB ports)

| Article | URL | Content |
|---------|-----|---------|
| **SPAT Revolution ↔ S6L** | [Flux documentation — Avid VENUE S6L](https://doc.flux.audio/spat-revolution/Third_Party_Avid_VENUE_S6L.html) | States **OSC** integration, ports on **ECx** vs **AVB** interfaces, and that **names** participate in **snapshots** in some workflows. **Verify** every claim against your Avid PDF generation. |

---

## Naming (investigation plan)

1. In **VENUE** software, locate **OSC input** / **Show Control** chapter: does it list an **address** for **channel name** or **track name**?  
2. If only **snapshot recall** is exposed, COL may need to **avoid** renaming (different product feature).  
3. Capture **one** manual strip rename while **Wireshark** filters **OSC**—confirm packet direction.

---

## Open points

- **Port numbers** vary by **interface** (ECx vs AVB); document **per-site** network diagrams.
- **Authentication / show file** locking—may block external writes during **checkout**.
