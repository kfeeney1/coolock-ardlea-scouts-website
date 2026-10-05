import { Button, Paper, Stack, TextField, Typography } from "@mui/material";
import type { ParentChildRequest } from "../services/parentChildMatching";

export default function ParentChildRequestFields({ children, setChildren }: { children: ParentChildRequest[]; setChildren: (value: ParentChildRequest[]) => void }) {
    const update = (index: number, field: keyof ParentChildRequest, value: string) => setChildren(children.map((child, i) => i === index ? { ...child, [field]: value } : child));
    return <Stack spacing={2}>
        <Typography variant="h6">Your child or children</Typography>
        <Typography color="text.secondary">Provide only the child's name and date of birth. These details are submitted for verification and never grant access automatically.</Typography>
        {children.map((child, index) => <Paper key={index} variant="outlined" sx={{ p: 2 }}>
            <Stack spacing={1.5}>
                <Typography sx={{ fontWeight: 800 }}>Child {index + 1}</Typography>
                <TextField label={`Child ${index + 1} first name`} value={child.firstName} onChange={(event) => update(index, "firstName", event.target.value)} required />
                <TextField label={`Child ${index + 1} surname`} value={child.lastName} onChange={(event) => update(index, "lastName", event.target.value)} required />
                <TextField label={`Child ${index + 1} date of birth`} type="date" value={child.dateOfBirth} onChange={(event) => update(index, "dateOfBirth", event.target.value)} slotProps={{ inputLabel: { shrink: true } }} required />
                {children.length > 1 && <Button color="secondary" onClick={() => setChildren(children.filter((_, i) => i !== index))}>Remove Child {index + 1}</Button>}
            </Stack>
        </Paper>)}
        {children.length < 8 && <Button variant="outlined" color="secondary" onClick={() => setChildren([...children, { firstName: "", lastName: "", dateOfBirth: "" }])}>Add another child</Button>}
    </Stack>;
}
