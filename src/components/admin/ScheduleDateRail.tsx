import { Box, Button, Typography } from "@mui/material";
import { useEffect, useLayoutEffect, useRef } from "react";
import { createScheduleScrollIntent } from "../../services/scheduleScrollIntent";
import { scheduleCalendarParts } from "../../services/scheduleCalendarParts";
import { formatSiteDate } from "../../services/siteDateFormat";
import { initialScheduleId, scheduleToday, type ScheduleIdentity } from "../../services/scheduleSelection";

export default function ScheduleDateRail({ items, selected, label, onSelect }: {
  items: (ScheduleIdentity & { title: string })[]; selected: string; label: string; onSelect: (id: string) => void;
}) {
  const rail = useRef<HTMLDivElement>(null);
  const fromScroll = useRef(false);
  const frame = useRef(0);
  const intent = useRef(createScheduleScrollIntent());
  const identity = items.map(item => item.id).join("|");
  const today = scheduleToday();
  const initial = initialScheduleId(items, today);
  const alignRail = () => {
    const node = rail.current;
    const button = node?.querySelector<HTMLButtonElement>('[aria-pressed="true"]');
    if (!node || !button) return;
    const left = Math.max(0, Math.min(node.scrollWidth - node.clientWidth, button.offsetLeft - (node.clientWidth - button.offsetWidth) / 2));
    if (Math.abs(node.scrollLeft - left) > 1) node.scrollTo({ left, behavior: "instant" });
  };
  useLayoutEffect(() => {
    if (!fromScroll.current) { intent.current.command(); cancelAnimationFrame(frame.current); alignRail(); }
    fromScroll.current = false;
  }, [selected, identity]);
  const selectCommand = (id: string) => {
    intent.current.command(); cancelAnimationFrame(frame.current); fromScroll.current = false; onSelect(id);
  };
  useEffect(() => () => cancelAnimationFrame(frame.current), []);
  return <Box ref={rail} role="group" aria-label={`${label} dates`} onPointerDown={() => intent.current.beginGesture()} onTouchStart={() => intent.current.beginGesture()} onWheel={() => intent.current.beginGesture()} onScroll={() => {
    const ticket = intent.current.ticket();
    if (ticket === null) { alignRail(); return; }
    cancelAnimationFrame(frame.current);
    frame.current = requestAnimationFrame(() => {
      if (!intent.current.accepts(ticket)) return;
      const node = rail.current;
      if (!node) return;
      const buttons = Array.from(node.querySelectorAll<HTMLButtonElement>("button"));
      const centre = node.scrollLeft + node.clientWidth / 2;
      const closest = buttons.reduce((best, button, index) => Math.abs(button.offsetLeft + button.offsetWidth / 2 - centre) < Math.abs(buttons[best].offsetLeft + buttons[best].offsetWidth / 2 - centre) ? index : best, 0);
      if (items[closest] && items[closest].id !== selected) { fromScroll.current = true; onSelect(items[closest].id); }
    });
  }} sx={{ position: "relative", display: "flex", gap: 1.5, "&::before, &::after": { content: '""', flex: { xs: "0 0 max(0px, calc(50% - 50px))", sm: "0 0 max(0px, calc(50% - 60px))" } }, overflowX: "auto", minWidth: 0, py: 1, px: 0.5, scrollSnapType: "x proximity", overscrollBehaviorX: "contain" }}>
    {items.map((item, index) => {
      const date = scheduleCalendarParts(item.date);
      const active = selected === item.id;
      const state = item.date <= today && (item.endDate || item.date) >= today ? "Today" : item.date < today ? "Past" : item.id === initial ? "Next" : date.month;
      return <Button key={item.id} aria-label={`Select ${formatSiteDate(item.date)} · ${item.title}`} aria-pressed={active} tabIndex={active ? 0 : -1} variant={active ? "contained" : "text"} color="secondary" onClick={() => selectCommand(item.id)} onKeyDown={event => {
        if (!["ArrowLeft", "ArrowRight", "Home", "End"].includes(event.key)) return;
        event.preventDefault();
        const next = event.key === "Home" ? 0 : event.key === "End" ? items.length - 1 : index + (event.key === "ArrowRight" ? 1 : -1);
        if (!items[next]) return;
        selectCommand(items[next].id);
        rail.current?.querySelectorAll<HTMLButtonElement>("button")[next]?.focus({ preventScroll: true });
      }} sx={{ flex: "0 0 auto", minWidth: { xs: 76, sm: 96 }, minHeight: 112, px: 1.5, display: "flex", flexDirection: "column", gap: 0.25, border: "1px solid", borderColor: active ? "secondary.main" : "divider", borderRadius: 2, scrollSnapAlign: "center", boxShadow: "none", bgcolor: active ? "secondary.main" : "background.paper", color: active ? "secondary.contrastText" : "text.primary", "&:hover": { bgcolor: active ? "secondary.dark" : "action.hover" } }}>
        <Typography component="span" variant="caption" sx={{ textTransform: "uppercase", fontWeight: 800 }}>{date.weekday}</Typography>
        <Typography component="span" variant="h4" sx={{ fontWeight: 800, lineHeight: 1.2 }}>{date.day}</Typography>
        <Typography component="span" variant="caption" sx={{ textTransform: "uppercase", fontWeight: active ? 800 : 400 }}>{state}</Typography>
      </Button>;
    })}
  </Box>;
}
