const redCross = 'https://www.redcross.org/take-a-class/resources/learn-first-aid/';

export const protocols = [
  {
    id: 'fracture', title: 'Suspected limb fracture', severity: 'SERIOUS',
    warning: 'Call for rescue. Keep the limb still. Never force a bent limb straight.',
    gear: { jacket: 'Soft splint padding', poles: 'Rigid splint supports, if trained', shirt: 'Soft padding' },
    source: 'https://www.nols.edu/blog/7-materials-that-can-be-used-to-improvise-a-splint/',
    steps: [
      { instruction: 'Support the injured limb in the position you found it.' },
      { instruction: 'Check skin color, warmth and feeling beyond the injury.' },
      { instruction: 'If trained and movement is necessary, pad and support the injured limb.' },
      { instruction: 'Leave fingers or toes visible. Recheck immediately after splinting and whenever symptoms change.',
        timerSeconds: 900, timerLabel: 'Additional circulation reminder' }
    ]
  },
  {
    id: 'bleeding', title: 'Severe external bleeding', severity: 'CRITICAL',
    warning: 'Call emergency services now. If an object is embedded, press around it.',
    gear: { shirt: 'Clean pressure pad' },
    source: redCross + 'bleeding-life-threatening-external',
    steps: [
      { instruction: 'Press firmly on the bleeding wound using gauze or clean cloth.' },
      { instruction: 'Maintain pressure. For life-threatening limb bleeding, use a commercial tourniquet if trained.' },
      { instruction: 'After bleeding stops, secure the dressing and watch for renewed bleeding.' },
      { instruction: 'Keep the person warm. Monitor breathing and alertness until responders arrive.' }
    ]
  },
  {
    id: 'hypothermia', title: 'Suspected hypothermia', severity: 'SERIOUS',
    warning: 'Request emergency help now. Handle the person gently and rewarm gradually.',
    gear: { jacket: 'Dry insulating layer', shirt: 'Dry replacement layer' },
    source: redCross + 'hypothermia',
    steps: [
      { instruction: 'Shelter the person from wind and rain.' },
      { instruction: 'Once sheltered, replace wet clothing with dry layers.' },
      { instruction: 'Insulate the head and body with dry clothing or blankets.' },
      { instruction: 'Monitor breathing and responsiveness while waiting for rescue.' }
    ]
  },
  {
    id: 'burn', title: 'Thermal burn', severity: 'UNASSESSED',
    warning: 'Seek urgent help for deep, extensive, facial, hand, foot, genital or joint burns.',
    gear: {},
    source: redCross + 'burns',
    steps: [
      { instruction: 'Move away from the heat source when safe.' },
      { instruction: 'Remove nearby jewelry and loose clothing. Leave stuck clothing in place.' },
      { instruction: 'Cool burned skin with clean running water for 5–20 minutes. Avoid ice.',
        timerSeconds: 1200, timerLabel: 'Cooling reminder (20 minutes)' },
      { instruction: 'Keep the person warm. Cover the burn loosely with a clean nonstick dressing.' }
    ]
  },
  {
    id: 'cpr', title: 'Adult CPR', severity: 'CRITICAL',
    warning: 'Use only for an unresponsive adult with absent breathing or only gasps.',
    gear: {},
    source: 'https://www.redcross.org/take-a-class/cpr/performing-cpr/cpr-steps',
    steps: [
      { instruction: 'Activate emergency services. Send someone for an AED immediately.' },
      { instruction: 'On a firm surface, place both hands centrally on the chest.' },
      { instruction: 'Compress 5–6 cm at 100–120 per minute. Allow full chest recoil.', bpm: 110 },
      { instruction: 'If trained, alternate 30 compressions with two breaths. Otherwise continue compressions.', bpm: 110 },
      { instruction: 'Follow AED prompts immediately. Continue until normal breathing returns or responders take over.' }
    ]
  }
];

const topicNames = new Map(protocols.flatMap(p => [[p.id, p], [p.title.toLowerCase(), p]]));
const patterns = {
  fracture: /\b(fractur(?:e|ed)|broken (?:leg|arm|ankle|wrist)|(?:leg|arm|ankle|wrist)\b.{0,30}\b(?:bent (?:weird|wrong|backwards)|deformed|crooked))\b/,
  bleeding: /\b((?:heavy|severe|uncontrolled|spurting|profuse) bleeding|bleeding (?:heavily|profusely|severely)|blood (?:is )?(?:spurting|gushing)|bleeding (?:will not|won't) stop)\b/,
  hypothermia: /\bhypothermia\b|^(?=.*\b(?:wet|soaked|cold|freezing)\b)(?=.*\b(?:shivering|confused|drowsy)\b)/,
  burn: /\b(?:scald(?:ed)?|thermal burn|burn(?:ed|t)?\b.{0,40}\b(?:stove|flame|fire|hot|boiling)|(?:stove|flame|fire|hot|boiling)\b.{0,40}\bburn(?:ed|t)?)\b/
};

// Offer one topic for confirmation. Multiple injuries and uncertain descriptions
// require manual selection; keyword retrieval cannot establish a diagnosis.
export function match(text) {
  if (typeof text !== 'string' || text.length > 4000) return null;
  const input = text.toLowerCase().replace(/[’‘]/g, "'").replace(/\s+/g, ' ').trim();
  if (topicNames.has(input)) return topicNames.get(input);
  if (/\b(?:baby|infant|toddler|kid|child|pediatric|dog|cat|electrical|electric|chemical|choking|drown(?:ed|ing)|overdose|spine|spinal|neck injury|skull|ribs?|pelvis|hip|internal|vomiting blood)\b/.test(input)) return null;
  const unconscious = /\b(?:unresponsive|unconscious|not responding|won't wake up)\b/.test(input);
  const abnormalBreathing = /\b(?:not breathing|isn't breathing|no breathing|only gasping|stopped breathing)\b/.test(input);
  const remaining = input.replace(/\b(?:not responding|won't wake up|not breathing|isn't breathing|no breathing|bleeding (?:will not|won't) stop)\b/g, '');
  if (/\b(?:no|not|never|without|denies|isn't|wasn't|was|history of|used to|previously|yesterday)\b/.test(remaining)) return null;
  if (unconscious || abnormalBreathing) {
    const conflictingSigns = /\b(?:awake|alert|talking|breathing normally|responding normally)\b/.test(remaining);
    return unconscious && abnormalBreathing && !conflictingSigns ? topicNames.get('cpr') : null;
  }
  const candidates = protocols.filter(p => patterns[p.id]?.test(input));
  return candidates.length === 1 ? candidates[0] : null;
}
