import assert from "node:assert/strict";
import test from "node:test";
import { validateTask } from "../src/tasks.js";
const input = {id: "12345678-1234-1234-1234-123456789012", description: " Fix the roof ", documentIds: []};
test("tasks support independent descriptions and optional unique retained documents", () => {
  assert.deepEqual(validateTask(input), {description: "Fix the roof", documentIds: []});
  assert.equal(validateTask({...input, documentIds: [input.id]}).documentIds.length, 1);
  for (const patch of [{id: "../x"}, {description: " "}, {description: "x".repeat(8001)}, {documentIds: [input.id, input.id]}, {documentIds: ["../outside"]}]) assert.throws(() => validateTask({...input, ...patch}));
});
