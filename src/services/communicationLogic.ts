export type CommunicationRecipient = {
    id: string;
    displayName: string;
    section: string;
    status: string;
};

export type CommunicationTemplate = "general" | "meeting-reminder" | "action-required";

export const communicationTemplates: Record<CommunicationTemplate, { label: string; subject: string; message: string }> = {
    general: {
        label: "General update",
        subject: "Scout Group update",
        message: "We have an update to share with you."
    },
    "meeting-reminder": {
        label: "Meeting reminder",
        subject: "Scout meeting reminder",
        message: "This is a reminder about the next Scout meeting. Please check the details shared by your section leaders."
    },
    "action-required": {
        label: "Action required",
        subject: "Action required – Coolock Ardlea Scouts",
        message: "Please review the information below and take the requested action as soon as you can."
    }
};

export function eligibleCommunicationRecipients(
    recipients: CommunicationRecipient[],
    section: string
): CommunicationRecipient[] {
    return recipients
        .filter((recipient) => recipient.status === "active")
        .filter((recipient) => section === "all" || recipient.section === section)
        .sort((a, b) => a.displayName.localeCompare(b.displayName));
}

export function validateCommunication(subject: string, message: string, recipientCount: number): string | null {
    if (recipientCount < 1) return "Select at least one recipient.";
    if (!subject.trim()) return "Enter a subject.";
    if (subject.trim().length > 120) return "Subject must be 120 characters or fewer.";
    if (!message.trim()) return "Enter a message.";
    if (message.trim().length > 2500) return "Message must be 2,500 characters or fewer.";
    return null;
}
