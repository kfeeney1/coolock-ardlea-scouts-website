const SECTION_ALIASES = new Map([
  ["beaver", "Beavers"], ["beavers", "Beavers"], ["beaver scout", "Beavers"], ["beaver scouts", "Beavers"],
  ["cub", "Cubs"], ["cubs", "Cubs"], ["cub scout", "Cubs"], ["cub scouts", "Cubs"],
  ["scout", "Scouts"], ["scouts", "Scouts"],
  ["venture", "Ventures"], ["ventures", "Ventures"], ["venture scout", "Ventures"], ["venture scouts", "Ventures"],
  ["rover", "Rovers"], ["rovers", "Rovers"], ["rover scout", "Rovers"], ["rover scouts", "Rovers"]
]);

const SECTION_STORAGE_ALIASES = Object.freeze({
  Beavers: Object.freeze(["Beavers", "Beaver", "Beaver Scout", "Beaver Scouts"]),
  Cubs: Object.freeze(["Cubs", "Cub", "Cub Scout", "Cub Scouts"]),
  Scouts: Object.freeze(["Scouts", "Scout"]),
  Ventures: Object.freeze(["Ventures", "Venture", "Venture Scout", "Venture Scouts"]),
  Rovers: Object.freeze(["Rovers", "Rover", "Rover Scout", "Rover Scouts"])
});

export function canonicalMemberSection(value) {
  const section = typeof value === "string" ? value.trim() : "";
  return SECTION_ALIASES.get(section.toLowerCase()) || section;
}

export function memberSectionStorageAliases(value) {
  const canonical = canonicalMemberSection(value);
  return SECTION_STORAGE_ALIASES[canonical] || [canonical];
}
