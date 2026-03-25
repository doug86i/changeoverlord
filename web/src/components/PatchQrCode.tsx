import { useQuery } from "@tanstack/react-query";
import { QRCodeSVG } from "qrcode.react";
import { useLayoutEffect, useMemo, useRef, useState } from "react";
import { apiGet } from "../api/client";
import { getPublicAppOrigin } from "../lib/publicAppOrigin";
import { useTheme } from "../theme/ThemeContext";

type SettingsRes = { hasPassword: boolean; publicBaseUrl: string | null };

/**
 * Scannable QR to this act’s patch page. URL uses Settings **links / QR base URL** when set,
 * otherwise the current page origin (`getPublicAppOrigin`).
 */
export function PatchQrLink({
  performanceId,
  size = 56,
  className,
  title = "Open patch / RF workbook on your phone (scan this code)",
}: {
  performanceId: string;
  size?: number;
  className?: string;
  title?: string;
}) {
  const { theme } = useTheme();
  const probeRef = useRef<HTMLDivElement | null>(null);
  const [colors, setColors] = useState({ fg: "", bg: "" });
  const [isZoomOpen, setIsZoomOpen] = useState(false);

  useLayoutEffect(() => {
    const el = probeRef.current;
    if (!el) return;
    const cs = getComputedStyle(el);
    setColors({ fg: cs.color, bg: cs.backgroundColor });
  }, [theme]);

  const settingsQ = useQuery({
    queryKey: ["settings"],
    queryFn: () => apiGet<SettingsRes>("/api/v1/settings"),
  });
  const origin = getPublicAppOrigin(settingsQ.data?.publicBaseUrl);
  const href = useMemo(
    () => `${origin}/patch/${performanceId}`,
    [origin, performanceId],
  );

  const fg = colors.fg || "rgb(17, 24, 39)";
  const bg = colors.bg || "rgb(255, 255, 255)";

  return (
    <>
      <div
        ref={probeRef}
        className="patch-qr-color-probe"
        aria-hidden
      />
      <a
        href={href}
        className={`patch-qr-link${className ? ` ${className}` : ""}`}
        title={title}
        aria-label={title}
        onClick={(e) => {
          e.preventDefault();
          e.stopPropagation();
          setIsZoomOpen(true);
        }}
      >
        <QRCodeSVG
          value={href}
          size={size}
          marginSize={1}
          level="M"
          fgColor={fg}
          bgColor={bg}
        />
      </a>
      {isZoomOpen ? (
        <div
          className="confirm-overlay"
          role="dialog"
          aria-modal="true"
          aria-label="Scan QR code"
          onClick={() => setIsZoomOpen(false)}
        >
          <div
            className="card patch-qr-zoom-modal"
            onClick={(e) => e.stopPropagation()}
          >
            <p className="muted patch-qr-zoom-lead">
              Scan this code on your phone to open Patch / RF.
            </p>
            <div className="patch-qr-zoom-code" role="img" aria-label={title}>
              <QRCodeSVG
                value={href}
                size={320}
                marginSize={1}
                level="M"
                fgColor={fg}
                bgColor={bg}
              />
            </div>
            <div className="form-row patch-qr-zoom-actions">
              <a
                href={href}
                className="button-link"
                target="_blank"
                rel="noopener noreferrer"
              >
                Open link
              </a>
              <button type="button" onClick={() => setIsZoomOpen(false)}>
                Close
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}
