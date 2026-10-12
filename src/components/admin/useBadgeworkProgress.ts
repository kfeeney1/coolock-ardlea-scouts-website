import { useCallback, useEffect, useRef, useState } from "react";
import { applicationErrorMessage } from "../../services/applicationErrors.ts";
import { loadMemberAdventureProgress, loadMemberAdventureProgressForMembers, type MemberAdventureProgress } from "../../services/adventureSkillProgress.ts";
import type { MemberRecord } from "../../services/memberAdmin";
export function useBadgeworkProgress(activeMembers: MemberRecord[], loading: boolean, mode: "overview" | "record", workflowStep: "members" | "badgework", selectedIds: string[], setError: (value: string) => void) {
 const [progressByMemberId,setProgressByMemberId] = useState(new Map<string,MemberAdventureProgress>());
 const [overviewLoaded,setOverviewLoaded] = useState(false);
 const [overviewError,setOverviewError] = useState("");
 const progressRequests = useRef(new Map<string,Promise<MemberAdventureProgress>>());
  const progressForMember = useCallback((memberId: string, forceRefresh = false) => {
    if (forceRefresh) progressRequests.current.delete(memberId);
    const existing = progressRequests.current.get(memberId);
    if (existing) return existing;
    const request = loadMemberAdventureProgress(memberId);
    progressRequests.current.set(memberId, request);
    void request.catch(() => {
      if (progressRequests.current.get(memberId) === request) progressRequests.current.delete(memberId);
    });
    return request;
  }, []);

  const refreshProgress = useCallback(async (memberIds: readonly string[], signal?: AbortSignal, forceRefresh = false) => {
    const missing = [...new Set(memberIds)].filter((memberId) => forceRefresh || !progressByMemberId.has(memberId));
    if (missing.length === 0 || signal?.aborted) return;
    const loaded = await loadMemberAdventureProgressForMembers(missing, {
      signal,
      loadMember: (memberId) => progressForMember(memberId, forceRefresh)
    });
    if (signal?.aborted) return;
    setProgressByMemberId((current) => {
      const next = new Map(current);
      for (const progress of loaded) next.set(progress.memberId, progress);
      return next;
    });
  }, [progressByMemberId, progressForMember]);

  useEffect(() => {
    if (workflowStep !== "badgework") return;
    const controller = new AbortController();
    void refreshProgress(selectedIds, controller.signal).catch((loadError) => {
      if (!controller.signal.aborted) setError(applicationErrorMessage(loadError, "Unable to load Adventure Skills progress.", "BadgeworkTracking"));
    });
    return () => controller.abort();
  }, [workflowStep, selectedIds, refreshProgress]);

  useEffect(() => {
    if (mode !== "overview" || loading || overviewLoaded || overviewError || activeMembers.length === 0) return;
    const controller = new AbortController();
    let active = true;
    void loadMemberAdventureProgressForMembers(activeMembers.map((member) => member.id), {
      signal: controller.signal,
      loadMember: progressForMember
    }).then((loaded) => {
        if (!active || controller.signal.aborted) return;
        setProgressByMemberId((current) => {
          const next = new Map(current);
          for (const progress of loaded) next.set(progress.memberId, progress);
          return next;
        });
        setOverviewLoaded(true);
      })
      .catch((loadError) => {
        if (active && !controller.signal.aborted) setOverviewError(applicationErrorMessage(loadError, "Unable to load the Badgework Overview. Please try again.", "BadgeworkTracking"));
      });
    return () => { active = false; controller.abort(); };
  }, [activeMembers, loading, mode, overviewError, overviewLoaded, progressForMember]);

 return {progressByMemberId,overviewLoaded,setOverviewLoaded,overviewError,setOverviewError,refreshProgress};
}
