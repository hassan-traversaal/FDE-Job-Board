import { ImageResponse } from "next/og";

export const size = { width: 64, height: 64 };
export const contentType = "image/png";

export default function Icon() {
  return new ImageResponse(
    <div
      style={{
        width: "100%",
        height: "100%",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        background: "#ff5c5c",
        color: "#ffffff",
        borderRadius: 14,
        fontFamily: "Arial, sans-serif",
        fontSize: 25,
        fontWeight: 800,
        letterSpacing: "-1px",
      }}
    >
      FDE
    </div>,
    size,
  );
}
