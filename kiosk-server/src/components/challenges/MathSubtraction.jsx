import { registerConfigSchema, computeDefaults } from './schemas.js';
import MathChallengeBase, { makeMathConfigSchema } from './MathChallengeBase.jsx';

export const configSchema = makeMathConfigSchema({
  description: 'How many subtraction problems to solve',
});

registerConfigSchema('math_subtraction', configSchema);

const DEFAULTS = computeDefaults(configSchema);

function generate(min, max) {
  let a = Math.floor(Math.random() * (max - min + 1)) + min;
  let b = Math.floor(Math.random() * (max - min + 1)) + min;
  if (a < b) [a, b] = [b, a];
  return { display: `${a} − ${b} = ?`, answer: a - b };
}

export default function MathSubtraction(props) {
  return <MathChallengeBase {...props} defaults={DEFAULTS} generateProblem={generate} challengeType="math_subtraction" />;
}
