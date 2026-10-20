import assert from "node:assert/strict";
import test from "node:test";
import { validateUpload } from "../src/documents.js";
const input = {id: "12345678-1234-1234-1234-123456789012", fileName: "Roof bill.pdf", contentType: "application/pdf", base64: Buffer.from("%PDF-1.4\nexample").toString("base64")};
test("documents validate size, type, file signature and stable identity before persistence", () => {
  assert.equal(validateUpload(input).bytes.length, 16);
  assert.equal(validateUpload(input).sha256, validateUpload(input).sha256);
  for (const patch of [{id: "../bad"}, {fileName: ""}, {contentType: "text/html"}, {base64: ""}, {base64: Buffer.from("<html>").toString("base64")}, {base64: "AA="}, {base64: Buffer.alloc(10 * 1024 * 1024 + 1).toString("base64")}]) assert.throws(() => validateUpload({...input, ...patch}));
});
