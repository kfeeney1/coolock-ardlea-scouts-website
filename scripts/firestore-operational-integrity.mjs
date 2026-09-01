const FINANCE_TYPES = new Set(["opening-float", "income", "expense", "transfer-in", "transfer-out", "adjustment"]);
const ITEM_CONDITIONS = new Set(["good", "needs-attention", "repair", "missing", "lost", "retired"]);
const HISTORY_TYPES = new Set(["item-created", "item-updated", "item-archived", "item-restored", "equipment-checked-out", "equipment-returned", "incident-reported", "incident-investigating", "incident-resolved", "stock-moved", "stock-moved-out", "stock-moved-in"]);

const text = (value) => typeof value === "string" ? value.trim() : "";
const whole = (value) => typeof value === "number" && Number.isInteger(value);
const positiveWhole = (value) => whole(value) && value > 0;
const nonNegativeWhole = (value) => whole(value) && value >= 0;
const dateOnly = (value) => /^\d{4}-\d{2}-\d{2}$/.test(text(value));

export function validateOperationalIntegrity(collections) {
  const errors = [];
  const fail = (collection, id, message) => errors.push(`${collection}/${id}: ${message}`);
  const records = (name) => collections.get(name) || new Map();
  const finance = records("financeTransactions");
  const items = records("equipmentItems");
  const categories = records("equipmentCategories");
  const locations = records("equipmentLocations");
  const categoryNames = new Set([...categories.values()].map((item) => text(item.name)).filter(Boolean));
  const locationNames = new Set([...locations.values()].map((item) => text(item.name)).filter(Boolean));

  for (const optionCollection of ["equipmentCategories", "equipmentLocations"]) {
    const seen = new Set();
    for (const [id, data] of records(optionCollection)) {
      const name = text(data.name);
      if (!name) fail(optionCollection, id, "name is required");
      const key = name.toLocaleLowerCase();
      if (name && seen.has(key)) fail(optionCollection, id, `duplicates option name ${JSON.stringify(name)}`);
      seen.add(key);
    }
  }

  for (const [id, data] of finance) {
    if (!text(data.section)) fail("financeTransactions", id, "section is required");
    if (!FINANCE_TYPES.has(data.type)) fail("financeTransactions", id, `unsupported type ${JSON.stringify(data.type)}`);
    if (!whole(data.amountCents) || (data.type !== "adjustment" && data.amountCents < 0) || (data.type === "adjustment" && data.amountCents === 0)) {
      fail("financeTransactions", id, "amountCents is invalid for the transaction type");
    }
    if (!text(data.category) || !text(data.description)) fail("financeTransactions", id, "category and description are required");
    if (!dateOnly(data.transactionDate)) fail("financeTransactions", id, "transactionDate must be YYYY-MM-DD");
    if (!text(data.createdBy)) fail("financeTransactions", id, "createdBy is required");
    const sourceId = text(data.sourceTransactionId);
    const reversalId = text(data.reversalOfTransactionId);
    if (["transfer-in", "transfer-out"].includes(data.type) && (!sourceId || !finance.has(sourceId))) {
      fail("financeTransactions", id, "transfer sourceTransactionId is missing or unresolved");
    }
    if (data.type === "adjustment" && (!reversalId || !finance.has(reversalId))) {
      fail("financeTransactions", id, "adjustment reversalOfTransactionId is missing or unresolved");
    }
  }

  for (const [id, data] of records("financeReconciliations")) {
    if (!text(data.section)) fail("financeReconciliations", id, "section is required");
    for (const field of ["expectedBalanceCents", "countedBalanceCents", "differenceCents"]) {
      if (!whole(data[field])) fail("financeReconciliations", id, `${field} must be whole cents`);
    }
    if (whole(data.expectedBalanceCents) && whole(data.countedBalanceCents) && whole(data.differenceCents)
      && data.differenceCents !== data.countedBalanceCents - data.expectedBalanceCents) {
      fail("financeReconciliations", id, "differenceCents does not match counted minus expected");
    }
    if (typeof data.balanced !== "boolean" || (whole(data.differenceCents) && data.balanced !== (data.differenceCents === 0))) {
      fail("financeReconciliations", id, "balanced does not match differenceCents");
    }
    if (!text(data.reconciledBy)) fail("financeReconciliations", id, "reconciledBy is required");
  }

  for (const [id, data] of items) {
    if (!text(data.name)) fail("equipmentItems", id, "name is required");
    if (!categoryNames.has(text(data.category))) fail("equipmentItems", id, `category ${JSON.stringify(data.category)} has no option source`);
    if (!locationNames.has(text(data.location))) fail("equipmentItems", id, `location ${JSON.stringify(data.location)} has no option source`);
    if (!["quantity", "individual"].includes(data.trackingMode)) fail("equipmentItems", id, "trackingMode is invalid");
    if (![data.totalQuantity, data.checkedOutQuantity, data.unavailableQuantity].every(nonNegativeWhole)) fail("equipmentItems", id, "stock quantities must be non-negative whole numbers");
    else if (data.checkedOutQuantity + data.unavailableQuantity > data.totalQuantity) fail("equipmentItems", id, "checked-out plus unavailable stock exceeds totalQuantity");
    if (!ITEM_CONDITIONS.has(data.condition)) fail("equipmentItems", id, `unsupported condition ${JSON.stringify(data.condition)}`);
    if (typeof data.archived !== "boolean") fail("equipmentItems", id, "archived must be boolean");
  }

  for (const [id, data] of records("equipmentLoans")) {
    if (!text(data.section) || !dateOnly(data.expectedReturnDate)) fail("equipmentLoans", id, "section and YYYY-MM-DD expectedReturnDate are required");
    if (!["open", "returned"].includes(data.status)) fail("equipmentLoans", id, "status must be open or returned");
    if (!Array.isArray(data.lines) || data.lines.length === 0) fail("equipmentLoans", id, "lines must be a non-empty array");
    for (const [index, line] of (Array.isArray(data.lines) ? data.lines : []).entries()) {
      if (!line || typeof line !== "object" || !items.has(text(line.itemId))) fail("equipmentLoans", id, `line ${index} references no equipment item`);
      if (!positiveWhole(line?.quantity) || !nonNegativeWhole(line?.returnedQuantity ?? 0) || !nonNegativeWhole(line?.incidentQuantity ?? 0)) fail("equipmentLoans", id, `line ${index} quantities are invalid`);
      else if ((line.returnedQuantity ?? 0) + (line.incidentQuantity ?? 0) > line.quantity) fail("equipmentLoans", id, `line ${index} resolves more stock than it issued`);
    }
  }

  for (const [id, data] of records("equipmentIncidents")) {
    if (!items.has(text(data.itemId))) fail("equipmentIncidents", id, "itemId references no equipment item");
    if (!positiveWhole(data.quantity)) fail("equipmentIncidents", id, "quantity must be a positive whole number");
    if (!["damaged", "lost", "missing", "maintenance"].includes(data.type)) fail("equipmentIncidents", id, "type is invalid");
    if (!["reported", "investigating", "resolved"].includes(data.status)) fail("equipmentIncidents", id, "status is invalid");
    if (text(data.loanId) && !records("equipmentLoans").has(text(data.loanId))) fail("equipmentIncidents", id, "loanId references no equipment loan");
  }

  for (const [id, data] of records("equipmentHistory")) {
    if (!items.has(text(data.itemId))) fail("equipmentHistory", id, "itemId references no equipment item");
    if (!HISTORY_TYPES.has(data.type)) fail("equipmentHistory", id, "type is invalid");
    if (!nonNegativeWhole(data.quantity)) fail("equipmentHistory", id, "quantity must be a non-negative whole number");
  }

  for (const [id, data] of records("equipmentProgrammeRequirements")) {
    if (!["weeklyMeeting", "event", "activity"].includes(data.sourceType) || !text(data.sourceId) || !text(data.section) || !dateOnly(data.date)) {
      fail("equipmentProgrammeRequirements", id, "source, section and date fields are invalid");
    }
    const sourceCollection = data.sourceType === "weeklyMeeting" ? "weeklyMeetings" : data.sourceType === "event" ? "events" : "";
    if (sourceCollection && !records(sourceCollection).has(text(data.sourceId))) fail("equipmentProgrammeRequirements", id, `sourceId references no ${sourceCollection} document`);
    if (!Array.isArray(data.lines)) fail("equipmentProgrammeRequirements", id, "lines must be an array");
    for (const [index, line] of (Array.isArray(data.lines) ? data.lines : []).entries()) {
      if (!line || typeof line !== "object" || !items.has(text(line.itemId)) || !positiveWhole(line.quantity)) fail("equipmentProgrammeRequirements", id, `line ${index} is invalid or references missing stock`);
    }
    if (text(data.loanId) && !records("equipmentLoans").has(text(data.loanId))) fail("equipmentProgrammeRequirements", id, "loanId references no equipment loan");
  }

  return errors.sort();
}

