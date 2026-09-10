from pathlib import Path

path = Path("firestore.rules")
text = path.read_text()

old_policy = '''        && request.resource.data.standardFamilyRatesCents is list
        && request.resource.data.standardFamilyRatesCents.size() == 4
        && request.resource.data.standardFamilyRatesCents[0] is number && request.resource.data.standardFamilyRatesCents[0] >= 0
        && request.resource.data.standardFamilyRatesCents[1] is number && request.resource.data.standardFamilyRatesCents[1] >= request.resource.data.standardFamilyRatesCents[0]
        && request.resource.data.standardFamilyRatesCents[2] is number && request.resource.data.standardFamilyRatesCents[2] >= request.resource.data.standardFamilyRatesCents[1]
        && request.resource.data.standardFamilyRatesCents[3] is number && request.resource.data.standardFamilyRatesCents[3] >= request.resource.data.standardFamilyRatesCents[2]
        && request.resource.data.leaderFamilyRatesCents is list
        && request.resource.data.leaderFamilyRatesCents.size() == 3
        && request.resource.data.leaderFamilyRatesCents[0] is number && request.resource.data.leaderFamilyRatesCents[0] >= 0
        && request.resource.data.leaderFamilyRatesCents[1] is number && request.resource.data.leaderFamilyRatesCents[1] >= request.resource.data.leaderFamilyRatesCents[0]
        && request.resource.data.leaderFamilyRatesCents[2] is number && request.resource.data.leaderFamilyRatesCents[2] >= request.resource.data.leaderFamilyRatesCents[1]
'''
new_policy = '''        && request.resource.data.standardFamilyRatesCents is list
        && request.resource.data.standardFamilyRatesCents.size() >= 1
        && request.resource.data.standardFamilyRatesCents[0] is number && request.resource.data.standardFamilyRatesCents[0] >= 0
        && request.resource.data.leaderFamilyRatesCents is list
        && request.resource.data.leaderFamilyRatesCents.size() >= 1
        && request.resource.data.leaderFamilyRatesCents[0] is number && request.resource.data.leaderFamilyRatesCents[0] >= 0
'''
if old_policy not in text:
    raise SystemExit("SW-52 policy anchor not found")
text = text.replace(old_policy, new_policy, 1)

start = text.index("      function isValidFamilyAssignment(policy) {")
end = text.index("      allow get, list: if isActiveLeader()", start)
helpers = '''      function isValidFamilyIncrement(rates, position, amount) {
        return rates is list
          && position is number
          && position >= 1
          && position <= rates.size()
          && rates[position - 1] is number
          && rates[position - 1] >= 0
          && ((position == 1 && amount == rates[0])
            || (position > 1
              && rates[position - 2] is number
              && rates[position - 2] >= 0
              && rates[position - 1] >= rates[position - 2]
              && amount == rates[position - 1] - rates[position - 2]));
      }
      function isValidFamilyAssignment(policy) {
        return request.resource.data.familyType in ["standard", "leader"]
          && request.resource.data.familyPosition is number
          && request.resource.data.familyPosition >= 1
          && ((request.resource.data.familyType == "standard"
              && request.resource.data.leaderChild == false
              && request.resource.data.sibling == (request.resource.data.familyPosition > 1)
              && ((request.resource.data.familyPosition == 1 && request.resource.data.category == "standard")
                || (request.resource.data.familyPosition > 1 && request.resource.data.category == "sibling"))
              && isValidFamilyIncrement(policy.standardFamilyRatesCents, request.resource.data.familyPosition, request.resource.data.amountDueCents))
            || (request.resource.data.familyType == "leader"
              && request.resource.data.leaderChild == true
              && request.resource.data.sibling == (request.resource.data.familyPosition > 1)
              && request.resource.data.category == "leader-child"
              && isValidFamilyIncrement(policy.leaderFamilyRatesCents, request.resource.data.familyPosition, request.resource.data.amountDueCents)));
      }
'''
text = text[:start] + helpers + text[end:]
path.write_text(text)
