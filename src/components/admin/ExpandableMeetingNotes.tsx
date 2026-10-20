import { Button, Typography } from "@mui/material";
import { useId, useLayoutEffect, useRef, useState } from "react";

export default function ExpandableMeetingNotes({ notes }: { notes: string }) {
  const [expanded, setExpanded] = useState(false);
  const [canExpand, setCanExpand] = useState(false);
  const textId = useId();
  const textRef = useRef<HTMLDivElement>(null);

  useLayoutEffect(() => {
    const element = textRef.current;
    if (!element || expanded) return;
    const measure = () => setCanExpand(element.scrollHeight > element.clientHeight + 1);
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(element);
    return () => observer.disconnect();
  }, [expanded, notes]);

  return <div>
    <Typography
      ref={textRef}
      id={textId}
      data-testid="weekly-meeting-notes-text"
      component="div"
      sx={{
        whiteSpace: "pre-wrap",
        overflowWrap: "anywhere",
        ...(!expanded && { display: "-webkit-box", WebkitBoxOrient: "vertical", WebkitLineClamp: 4, overflow: "hidden" }),
      }}
    >{notes}</Typography>
    {canExpand && <Button
      type="button"
      size="small"
      aria-controls={textId}
      aria-expanded={expanded}
      onClick={() => setExpanded(value => !value)}
      sx={{ minHeight: 44, mt: 0.5, px: 0 }}
    >{expanded ? "Show less" : "Show more"}</Button>}
  </div>;
}
