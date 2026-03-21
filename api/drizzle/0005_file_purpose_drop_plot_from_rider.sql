-- Collapse plot_from_rider into plot_pdf (same UI: "stage plot"); new code no longer emits plot_from_rider.
UPDATE "file_assets" SET "purpose" = 'plot_pdf' WHERE "purpose" = 'plot_from_rider';
