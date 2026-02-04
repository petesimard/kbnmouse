import MathChallenge from './MathChallenge';
import TypingChallenge from './TypingChallenge';

export { getConfigFields, getDefaults, buildZodSchema } from './schemas.js';

const challengeRegistry = {
  math: MathChallenge,
  typing: TypingChallenge,
};

export function getChallengeComponent(type) {
  return challengeRegistry[type] || null;
}

export function getChallengeTypes() {
  return Object.keys(challengeRegistry);
}
