import { SHORT_BUILD_COMMIT } from "../buildInfo";
import { appEnvironment } from "../firebase";

export default function TestEnvironmentBanner() {
  if (appEnvironment !== "test") return null;

  return (
    <div
      role="status"
      aria-label="Test environment"
      data-testid="test-environment-banner"
      style={{
        position: "relative",
        zIndex: 1000,
        boxSizing: "border-box",
        width: "100%",
        maxWidth: "100vw",
        padding: "0.3rem 0.65rem",
        textAlign: "center",
        fontSize: "0.78rem",
        lineHeight: 1.25,
        fontWeight: 700,
        letterSpacing: "0.01em",
        overflowWrap: "anywhere",
        background: "#fff3cd",
        color: "#3d2f00",
        borderBottom: "1px solid #8a6d00",
      }}
    >
      TEST · synthetic data · Build {SHORT_BUILD_COMMIT}
    </div>
  );
}
