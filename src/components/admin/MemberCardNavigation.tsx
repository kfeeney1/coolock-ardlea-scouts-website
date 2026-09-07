import { useEffect } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { sectionVisualTokens } from "../../theme/sectionColours";

const memberSections = ["Beavers", "Cubs", "Scouts", "Ventures", "Rovers", "Group", "Other"] as const;

function applySectionIdentity(card: HTMLElement) {
  const chipLabels = Array.from(card.querySelectorAll<HTMLElement>(".MuiChip-label"));
  const sectionLabel = chipLabels.find((label) => memberSections.includes(label.textContent?.trim() as typeof memberSections[number]));
  if (!sectionLabel) return;

  const section = sectionLabel.textContent?.trim();
  if (!section) return;

  const tokens = sectionVisualTokens(section);
  card.dataset.section = tokens.section ?? section;
  card.style.borderLeftWidth = "4px";
  card.style.borderLeftStyle = "solid";
  card.style.borderLeftColor = tokens.accent;

  const sectionChip = sectionLabel.closest<HTMLElement>(".MuiChip-root");
  if (sectionChip) {
    sectionChip.dataset.sectionIdentity = tokens.section ?? section;
    sectionChip.style.borderColor = tokens.border;
    sectionChip.style.backgroundColor = tokens.subtleBackground;
    sectionChip.style.color = tokens.foreground;
  }
}

export default function MemberCardNavigation() {
  const location = useLocation();
  const navigate = useNavigate();

  useEffect(() => {
    if (location.pathname !== "/leader/members") return;

    const handleClick = (event: MouseEvent) => {
      const target = event.target as HTMLElement | null;
      const card = target?.closest<HTMLElement>('[data-testid^="member-card-"]');
      if (!card) return;
      const memberId = card.dataset.testid?.replace("member-card-", "");
      if (!memberId) return;
      event.preventDefault();
      event.stopPropagation();
      navigate(`/leader/members/${encodeURIComponent(memberId)}`);
    };

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key !== "Enter" && event.key !== " ") return;
      const target = event.target as HTMLElement | null;
      const card = target?.closest<HTMLElement>('[data-testid^="member-card-"]');
      if (!card || target !== card) return;
      const memberId = card.dataset.testid?.replace("member-card-", "");
      if (!memberId) return;
      event.preventDefault();
      navigate(`/leader/members/${encodeURIComponent(memberId)}`);
    };

    const prepareCards = () => {
      document.querySelectorAll<HTMLElement>('[data-testid^="member-card-"]').forEach((card) => {
        card.tabIndex = 0;
        card.setAttribute("role", "link");
        card.setAttribute("aria-label", `Open member record ${card.textContent?.trim().split("Parent / Guardian:")[0]?.trim() || ""}`.trim());
        card.style.cursor = "pointer";
        applySectionIdentity(card);
      });
    };

    prepareCards();
    const observer = new MutationObserver(prepareCards);
    observer.observe(document.body, { childList: true, subtree: true });
    document.addEventListener("click", handleClick, true);
    document.addEventListener("keydown", handleKeyDown, true);
    return () => {
      observer.disconnect();
      document.removeEventListener("click", handleClick, true);
      document.removeEventListener("keydown", handleKeyDown, true);
    };
  }, [location.pathname, navigate]);

  return null;
}
