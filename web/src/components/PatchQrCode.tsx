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
        onClick={(e) => e.stopPropagation()}
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
    </>
  );
}
