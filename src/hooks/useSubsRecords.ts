import { useCallback, useEffect, useMemo, useRef, useState, type Dispatch, type SetStateAction } from "react";
import { applicationErrorMessage } from "../services/applicationErrors.ts";
import type { MemberRecord } from "../services/memberAdmin";
import { loadSubsAssignments, loadSubsMembers, loadSubsPayments, loadSubsPolicies } from "../services/subsLedger";
import { resolveCurrentSubsPolicy, type SubsAssignment, type SubsPayment, type SubsRatePolicy } from "../services/subsLogic";
import { ALL_AUTHORISED_SECTIONS, isMemberInSubsScope, normaliseSubsSection, selectableSubsSections } from "../services/subsScope";

const uniquePayments = (rows: SubsPayment[]) => [...new Map(rows.map((row) => [row.id, row])).values()];

export function useSubsRecords(
  userId: string | undefined,
  authorisedSections: string[],
  canGroupReport: boolean,
  setPeriod: Dispatch<SetStateAction<string>>,
) {
  const [members, setMembers] = useState<MemberRecord[]>([]);
  const [policies, setPolicies] = useState<SubsRatePolicy[]>([]);
  const [assignments, setAssignments] = useState<SubsAssignment[]>([]);
  const [payments, setPayments] = useState<SubsPayment[]>([]);
  const scopeKey = JSON.stringify([userId, authorisedSections, canGroupReport]);
  const [loadedScope, setLoadedScope] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [section, setSection] = useState(() => new URLSearchParams(window.location.search).get("section") ?? ALL_AUTHORISED_SECTIONS);
  const loadVersion = useRef(0);
  const selectableSections = useMemo(
    () =>
      selectableSubsSections(
        authorisedSections,
        canGroupReport,
        members.map((member) => member.section),
      ),
    [authorisedSections, canGroupReport, members],
  );
  const effectiveSection = normaliseSubsSection(section, selectableSections, canGroupReport);
  useEffect(() => {
    if (section !== effectiveSection) setSection(effectiveSection);
  }, [effectiveSection, section]);
  useEffect(() => {
    const url = new URL(window.location.href);
    if (effectiveSection === ALL_AUTHORISED_SECTIONS) url.searchParams.delete("section");
    else url.searchParams.set("section", effectiveSection);
    window.history.replaceState(window.history.state, "", `${url.pathname}${url.search}${url.hash}`);
  }, [effectiveSection]);
  const load = useCallback(async () => {
    const version = ++loadVersion.current;
    setLoadedScope("");
    setLoading(true);
    setError("");
    try {
      const [assignmentRows, paymentRows, memberRows, policyRows] = await Promise.all([
        canGroupReport ? loadSubsAssignments() : Promise.all(authorisedSections.map((value) => loadSubsAssignments(value))).then((rows) => rows.flat()),
        canGroupReport ? loadSubsPayments() : Promise.all(authorisedSections.map((value) => loadSubsPayments(value))).then((rows) => rows.flat()),
        loadSubsMembers(canGroupReport ? undefined : authorisedSections),
        loadSubsPolicies(),
      ]);
      if (version !== loadVersion.current) return;
      setLoadedScope(scopeKey);
      setMembers(memberRows);
      setPolicies(policyRows);
      setAssignments(assignmentRows);
      setPayments(uniquePayments(paymentRows));
      const currentPolicy = resolveCurrentSubsPolicy(policyRows);
      setPeriod((current) => current && policyRows.some((policy) => policy.period === current) ? current : currentPolicy?.period ?? "");
    } catch (e) {
      if (version === loadVersion.current) setError(applicationErrorMessage(e, "Unable to load Subs data. Try again.", "SubsManagement"));
    } finally {
      if (version === loadVersion.current) setLoading(false);
    }
  }, [authorisedSections, canGroupReport, scopeKey, setPeriod]);
  useEffect(() => {
    void load();
    return () => { ++loadVersion.current; };
  }, [load]);
  const currentPolicy = useMemo(() => resolveCurrentSubsPolicy(policies), [policies]);
  const visibleMembers = useMemo(() => members.filter((member) => isMemberInSubsScope(member.section, effectiveSection, authorisedSections, canGroupReport)), [authorisedSections, canGroupReport, effectiveSection, members]);
  const visibleAssignments = useMemo(() => assignments.filter((assignment) => isMemberInSubsScope(assignment.section, effectiveSection, authorisedSections, canGroupReport)), [assignments, authorisedSections, canGroupReport, effectiveSection]);
  const visiblePayments = useMemo(() => (effectiveSection === ALL_AUTHORISED_SECTIONS ? payments : payments.filter((payment) => payment.section === effectiveSection || visibleAssignments.some((assignment) => assignment.accountId && assignment.accountId === payment.accountId))), [effectiveSection, payments, visibleAssignments]);

  return {
    members, policies, assignments, currentPolicy,
    visibleMembers, visibleAssignments, visiblePayments,
    effectiveSection, selectableSections, setSection,
    scopeKey, loadedScope, loading, error, setError, load,
  };
}
