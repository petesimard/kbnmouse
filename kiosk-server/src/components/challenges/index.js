import MathChallenge from './MathChallenge';
import TypingChallenge from './TypingChallenge';

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
