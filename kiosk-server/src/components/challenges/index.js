import MathAddition from './MathChallenge';
import MathSubtraction from './MathSubtraction';
import MathMultiplication from './MathMultiplication';
import MathDivision from './MathDivision';
import TypingChallenge from './TypingChallenge';
import StoryWriterChallenge from './StoryWriterChallenge';
import HackingChallenge from './HackingChallenge';

export { getConfigFields, getDefaults, buildZodSchema } from './schemas.js';

const challengeRegistry = {
  math_addition: { component: MathAddition, label: 'Math - Addition' },
  math_subtraction: { component: MathSubtraction, label: 'Math - Subtraction' },
  math_multiplication: { component: MathMultiplication, label: 'Math - Multiplication' },
  math_division: { component: MathDivision, label: 'Math - Division' },
  typing: { component: TypingChallenge, label: 'Typing' },
  story_writer: { component: StoryWriterChallenge, label: 'Story Writer' },
  hacking: { component: HackingChallenge, label: 'Hacking' },
};

export function getChallengeComponent(type) {
  return challengeRegistry[type]?.component || null;
}

export function getChallengeTypes() {
  return Object.keys(challengeRegistry);
}

export function getChallengeLabel(type) {
  return challengeRegistry[type]?.label || type;
}
