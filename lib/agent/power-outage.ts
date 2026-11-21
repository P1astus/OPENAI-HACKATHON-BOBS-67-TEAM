const WHOLE_HOME = [
  /\b(?:no (?:power|electricity)|power (?:is )?(?:out|off)|power outage) (?:in|for|throughout) (?:the |my |our )?(?:whole |entire )?(?:flat|apartment|home|house)\b(?!['’]s\b)/i,
  /\b(?:whole|entire) (?:flat|apartment|home|house) (?:has no|is without) (?:power|electricity)\b/i,
  /\b(?:every|all) (?:power )?(?:sockets?|outlets?)(?: in (?:the |my |our )?(?:whole |entire )?(?:flat|apartment|home|house))? (?:have no power|(?:is |are |have gone )?(?:dead|out|without power|not working))\b/i,
  /\b(?:stromausfall|kein strom)\s+(?:in der|im)\s+(?:ganzen|gesamten)\s+(?:wohnung|haus)\b|\balle steckdosen (?:sind tot|haben keinen strom|funktionieren nicht)\b/i,
];
const GERMAN_OUTAGE = /\b(?:stromausfall|kein strom)\b/i;
const LOCAL_OUTAGE = /\b(?:steckdosen?|sockets?|outlets?|geräte?|lichtschalter|lampe)\b/i;
const BARE_ENGLISH_OUTAGE = /^(?:there(?:'s| is) |(?:i|we) have )?no (?:power|electricity)(?: at all| anymore)?[.!]?$/i;

export function wholeHomePowerOutage(report: string): boolean {
  return WHOLE_HOME.some((rule) => rule.test(report))
    || BARE_ENGLISH_OUTAGE.test(report.trim())
    || (GERMAN_OUTAGE.test(report) && !LOCAL_OUTAGE.test(report));
}
