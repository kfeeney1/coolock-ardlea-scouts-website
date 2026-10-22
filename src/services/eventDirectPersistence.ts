import { eventParentProgramme, eventAudienceDates } from "./eventParentProgramme";
import { collection, doc, getDoc, getDocs, query, serverTimestamp, where, writeBatch } from "firebase/firestore";
import { auth, db } from "../firebase";
import { ServiceFailure, UserFacingError } from "./applicationErrors.ts";
import { recordAuditEvent } from "./auditLog";
import { buildEventAudienceMemberships, eventAudienceMembershipPath, shouldPreserveLegacyEventAudience, withPersistedEventAudience } from "./eventAudienceMemberships";
import { buildEventAudience, defaultEventAudienceForClassification } from "./eventManagementLogic";
import { canTransitionEventStatus, eventCloseOutIssues } from "./eventLifecycleLogic";
import { loadMembers } from "./memberAdmin";
import { eventPersistenceHelpers } from "./eventAdmin";
import type { EventInput, EventStatus } from "./eventAdmin";

// Restored pre-SW-212 authenticated Firestore persistence for TEST.
export async function createEventDirect(input: EventInput, eventId?: string, onEventIdAllocated?: (id: string) => void): Promise<string> {
    const { clean, authorisedEventAudienceSections, syncEventProjections } = eventPersistenceHelpers;
    const user = auth.currentUser;
    if (!user) throw new ServiceFailure("No signed-in leader.", "auth/unauthenticated");
    const title = clean(input.title, 200);
    if (!title) throw new UserFacingError("Event title is required.");
    if (input.status !== "draft" && input.status !== "open") throw new UserFacingError("New events must start as Draft or Open.");

    const [loadedMembers, authorisedSections] = await Promise.all([loadMembers(), authorisedEventAudienceSections(user.uid)]);
    const members = loadedMembers.filter((member) => member.status === "active");
    const canonicalAudience = buildEventAudience(input.audience?.sectionIds ?? [], input.audience?.memberIds ?? [], members);
    if (canonicalAudience.resolvedMemberIds.length === 0) throw new UserFacingError("Choose at least one active, authorised member for this event audience.");
    if (canonicalAudience.resolvedMemberIds.length > 450) throw new UserFacingError("An event audience cannot exceed 450 active members.");
    const eventAudience = withPersistedEventAudience(canonicalAudience);
    const eventRef = eventId ? doc(db, "events", eventId) : doc(collection(db, "events"));
    onEventIdAllocated?.(eventRef.id);
    const existing = await getDoc(eventRef);
    if (existing.exists()) {
        const data = existing.data();
        const limits: Record<string, number> = { title: 200, description: 3000, eventType: 80, section: 80, location: 300, meetingPoint: 500, returnDetails: 500, leaderNotes: 3000, startDate: 30, endDate: 30 };
        const sameDetails = Object.entries(input).filter(([key]) => key !== "audience").every(([key, value]) =>
            data[key] === (typeof value === "string" ? clean(value, limits[key] ?? value.length) : value));
        const savedAudience = existing.data().audience;
        const sameAudience = savedAudience?.mode === eventAudience.mode && JSON.stringify(savedAudience?.sectionIds) === JSON.stringify(eventAudience.sectionIds);
        const savedMemberships = await getDocs(query(collection(db, "events", eventRef.id, "audienceMembers"), where("eventId", "==", eventRef.id)));
        const sameMembers = JSON.stringify(savedMemberships.docs.map(item => item.id).sort()) === JSON.stringify(canonicalAudience.resolvedMemberIds.slice().sort());
        if (data.createdBy !== user.uid || !sameDetails || !sameAudience || !sameMembers) {
            throw new UserFacingError("This event ID is already in use. Reopen the saved event before retrying.");
        }
        await syncEventProjections(eventRef.id, { ...input, title, audience: canonicalAudience });
        return eventRef.id;
    }
    const memberships = buildEventAudienceMemberships(eventRef.id, clean(input.section, 80), canonicalAudience, members, authorisedSections);
    if (memberships.length !== canonicalAudience.resolvedMemberIds.length) throw new UserFacingError("The event audience includes a member who is no longer active or is outside your authorised scope.");

    const eventPayload = {
        title,
        description: clean(input.description, 3000),
        eventType: clean(input.eventType, 80),
        section: clean(input.section, 80),
        location: clean(input.location, 300),
        meetingPoint: clean(input.meetingPoint, 500),
        returnDetails: clean(input.returnDetails, 500),
        leaderNotes: clean(input.leaderNotes, 3000),
        startDate: clean(input.startDate, 30),
        endDate: clean(input.endDate, 30),
        status: input.status,
        consentRequired: input.consentRequired,
        audience: eventAudience,
        attendance: Object.fromEntries(canonicalAudience.resolvedMemberIds.map((id) => [id, "invited"])),
        consent: Object.fromEntries(canonicalAudience.resolvedMemberIds.map((id) => [id, input.consentRequired ? "required" : "not-required"])),
        createdAt: serverTimestamp(),
        createdBy: user.uid,
        updatedAt: serverTimestamp(),
        updatedBy: user.uid
    };
    // Keep the event document and every audience membership in one Firestore commit.
    // The 450-member cap leaves room for the event write under Firestore's 500-write limit.
    const createBatch = writeBatch(db);
    createBatch.set(eventRef, eventPayload);
    createBatch.set(doc(db, "events", eventRef.id, "programmes", "parent"), eventParentProgramme(eventRef.id, input));
    memberships.forEach((membership) => createBatch.set(
        doc(db, eventAudienceMembershipPath(eventRef.id, membership.memberId)),
        { ...membership, ...eventAudienceDates(input), updatedAt: serverTimestamp(), updatedBy: user.uid }
    ));
    await createBatch.commit();

    await syncEventProjections(eventRef.id, { ...input, title, audience: canonicalAudience });
    await recordAuditEvent({
        category: "event",
        action: "Event created",
        targetId: eventRef.id,
        targetLabel: title,
        section: clean(input.section, 80),
        description: `Created event with status ${input.status}${input.consentRequired ? "; consent required" : ""}.`
    });
    return eventRef.id;
}

export async function updateEventDirect(eventId: string, input: EventInput, removalsConfirmed = false): Promise<void> {
    const { clean, authorisedEventAudienceSections, syncEventProjections, EVENT_STATUSES, mapAttendance, mapConsent, mapAudience } = eventPersistenceHelpers;
    const user = auth.currentUser;
    if (!user) throw new ServiceFailure("No signed-in leader.", "auth/unauthenticated");

    const eventRef = doc(db, "events", eventId);
    const currentSnapshot = await getDoc(eventRef);
    if (!currentSnapshot.exists()) throw new UserFacingError("Event not found.");
    const current = currentSnapshot.data();
    const currentStatus = current.status as EventStatus;
    if (!EVENT_STATUSES.includes(currentStatus)) throw new UserFacingError("Event has an invalid current status.");
    if (!canTransitionEventStatus(currentStatus, input.status)) {
        throw new Error(`Event status cannot move directly from ${currentStatus} to ${input.status}.`);
    }
    if (input.status === "completed") {
        const issues = eventCloseOutIssues({
            status: currentStatus,
            consentRequired: current.consentRequired === true,
            attendance: mapAttendance(current.attendance),
            consent: mapConsent(current.consent)
        });
        if (issues.length > 0) throw new Error(issues.join(" "));
    }

    const [loadedMembers, authorisedSections] = await Promise.all([loadMembers(), authorisedEventAudienceSections(user.uid)]);
    const members = loadedMembers.filter((member) => member.status === "active");
    const visibleAudience = buildEventAudience(input.audience?.sectionIds ?? [], input.audience?.memberIds ?? [], members);
    const currentAudience = mapAudience(current.audience);
    const preserveLegacyAudience = shouldPreserveLegacyEventAudience(
        currentAudience,
        input.audience,
        defaultEventAudienceForClassification(clean(current.section, 80), members)
    );
    const preservedAudience = currentAudience ?? defaultEventAudienceForClassification(clean(current.section, 80), members);
    const previousMembershipSnapshot = await getDocs(query(
        collection(db, "events", eventId, "audienceMembers"),
        where("eventId", "==", eventId)
    ));
    // Editing an event must not silently discard invitees the editor can no longer
    // inspect. Preserve existing section-derived entries while that section remains
    // selected, and individual entries while their member IDs remain selected. These
    // records are left untouched; new or changed entries still pass normal scope rules.
    const retainedHiddenMemberships = previousMembershipSnapshot.docs
        .filter((item) => !loadedMembers.some((member) => member.id === item.id))
        .filter((item) => {
            const membership = item.data();
            return (membership.selectedBySection === true && input.audience?.sectionIds.includes(membership.scopeSection))
                || (membership.selectedIndividually === true && input.audience?.memberIds.includes(item.id));
        });
    const canonicalAudience = {
        ...visibleAudience,
        resolvedMemberIds: [...new Set([...visibleAudience.resolvedMemberIds, ...retainedHiddenMemberships.map((item) => item.id)])]
    };
    if (canonicalAudience.resolvedMemberIds.length === 0) throw new UserFacingError("Choose at least one active, authorised member for this event audience.");
    if (canonicalAudience.resolvedMemberIds.length > 450) throw new UserFacingError("An event audience cannot exceed 450 active members.");
    const eventAudience = withPersistedEventAudience(canonicalAudience);
    const memberships = buildEventAudienceMemberships(eventId, clean(input.section, 80), visibleAudience, members, authorisedSections);
    if (memberships.length !== visibleAudience.resolvedMemberIds.length) throw new UserFacingError("The event audience includes a member who is no longer active or is outside your authorised scope.");
    const previousMembershipById = new Map(previousMembershipSnapshot.docs.map((item) => [item.id, item.data()]));
    const changedMemberships = memberships.filter((membership) => {
        const previous = previousMembershipById.get(membership.memberId);
        return !previous
            || previous.eventSection !== membership.eventSection
            || previous.scopeSection !== membership.scopeSection
            || previous.selectedBySection !== membership.selectedBySection
            || previous.selectedIndividually !== membership.selectedIndividually
            || Object.entries(eventAudienceDates(input)).some(([key, value]) => previous[key] !== value);
    });
    const nextMembershipIds = new Set([
        ...memberships.map((membership) => membership.memberId),
        ...retainedHiddenMemberships.map((item) => item.id)
    ]);
    const nextAudienceIds = [...nextMembershipIds];
    const previousAttendance = mapAttendance(current.attendance);
    const previousConsent = mapConsent(current.consent);
    // Audience membership is a snapshot. Keep historical response/consent keys for people
    // removed from the current audience; eventMembers() controls who is operationally in
    // scope, so retained history is not mistaken for a current invitation.
    const reconciledAttendance = { ...previousAttendance };
    const reconciledConsent = { ...previousConsent };
    nextAudienceIds.forEach((id) => {
        reconciledAttendance[id] ??= "invited";
        reconciledConsent[id] ??= input.consentRequired ? "required" : "not-required";
    });

    const updatePayload = {
        title: clean(input.title, 200),
        description: clean(input.description, 3000),
        eventType: clean(input.eventType, 80),
        section: clean(input.section, 80),
        location: clean(input.location, 300),
        meetingPoint: clean(input.meetingPoint, 500),
        returnDetails: clean(input.returnDetails, 500),
        leaderNotes: clean(input.leaderNotes, 3000),
        startDate: clean(input.startDate, 30),
        endDate: clean(input.endDate, 30),
        status: input.status,
        consentRequired: input.consentRequired,
        ...(preserveLegacyAudience ? {} : { audience: eventAudience }),
        attendance: reconciledAttendance,
        consent: reconciledConsent,
        updatedAt: serverTimestamp(),
        updatedBy: user.uid
    };

    const membershipsToWrite = preserveLegacyAudience ? [] : changedMemberships;
    const removedMemberships = preserveLegacyAudience ? [] : previousMembershipSnapshot.docs.filter((item) => !nextMembershipIds.has(item.id));
    if (removedMemberships.length > 0 && !removalsConfirmed) throw new UserFacingError("Confirm audience removals before saving.");
    const dateOnlyMemberships = preserveLegacyAudience ? previousMembershipSnapshot.docs : retainedHiddenMemberships;
    const audienceWriteCount = 2 + membershipsToWrite.length + removedMemberships.length + dateOnlyMemberships.length;
    if (audienceWriteCount > 500) {
        throw new UserFacingError("This audience change is too large to save safely in one operation. Make the change in smaller steps and try again.");
    }

    // Commit the event, changed audience rows, and removals together. A failed write
    // leaves the previous audience and response history intact.
    const updateBatch = writeBatch(db);
    updateBatch.update(eventRef, updatePayload);
    updateBatch.set(doc(db, "events", eventId, "programmes", "parent"), eventParentProgramme(eventId, input));
    dateOnlyMemberships.forEach(item => updateBatch.update(item.ref, {...eventAudienceDates(input), updatedAt: serverTimestamp(), updatedBy: user.uid}));
    membershipsToWrite.forEach((membership) => updateBatch.set(
        doc(db, eventAudienceMembershipPath(eventId, membership.memberId)),
        { ...membership, ...eventAudienceDates(input), updatedAt: serverTimestamp(), updatedBy: user.uid }
    ));
    removedMemberships.forEach((item) => updateBatch.delete(item.ref));
    await updateBatch.commit();

    await syncEventProjections(eventId, { ...input, audience: preserveLegacyAudience ? (current.audience ? preservedAudience : null) : canonicalAudience });
    await recordAuditEvent({
        category: "event",
        action: input.status === "completed" ? "Event completed" : "Event updated",
        targetId: eventId,
        targetLabel: clean(input.title, 200),
        section: clean(input.section, 80),
        description: input.status === "completed"
            ? "Completed event after attendance and consent close-out checks passed."
            : `Updated event; status is ${input.status}${input.consentRequired ? "; consent required" : ""}; audience additions: ${membershipsToWrite.filter((membership) => !previousMembershipById.has(membership.memberId)).length}; audience removals: ${removedMemberships.length}.`
    });
}

