import { appEnvironment } from "../firebase";

export default function TestEnvironmentBanner() {
  if (appEnvironment !== "test") return null;

  return (
    <div
      role="status"
      aria-label="Test environment"
      style={{
        position: "relative",
        zIndex: 1000,
        width: "100%",
        padding: "0.55rem 1rem",
        textAlign: "center",
        fontWeight: 700,
        letterSpacing: "0.02em",
        background: "#fff3cd",
        color: "#3d2f00",
        borderBottom: "2px solid #8a6d00",
      }}
    >
      TEST ENVIRONMENT — synthetic test data only. This is not the live website.
    </div>
  );
}
