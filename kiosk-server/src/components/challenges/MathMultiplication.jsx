import { registerConfigSchema, computeDefaults } from './schemas.js';
import MathChallengeBase, { makeMathConfigSchema } from './MathChallengeBase.jsx';

export const configSchema = makeMathConfigSchema({
  description: 'How many multiplication problems to solve',
  minDefault: 2,
  maxDefault: 12,
});

registerConfigSchema('math_multiplication', configSchema);

const DEFAULTS = computeDefaults(configSchema);

function generate(min, max) {
  const a = Math.floor(Math.random() * (max - min + 1)) + min;
  const b = Math.floor(Math.random() * (max - min + 1)) + min;
  return { display: `${a} × ${b} = ?`, answer: a * b };
}

export default function MathMultiplication(props) {
  return <MathChallengeBase {...props} defaults={DEFAULTS} generateProblem={generate} challengeType="math_multiplication" />;
}
