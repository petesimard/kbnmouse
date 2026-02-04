import { registerConfigSchema, computeDefaults } from './schemas.js';
import MathChallengeBase, { makeMathConfigSchema } from './MathChallengeBase.jsx';

export const configSchema = makeMathConfigSchema({
  description: 'How many division problems to solve',
  minDefault: 2,
  maxDefault: 12,
});

registerConfigSchema('math_division', configSchema);

const DEFAULTS = computeDefaults(configSchema);

function generate(min, max) {
  const b = Math.floor(Math.random() * (max - min + 1)) + min;
  const quotient = Math.floor(Math.random() * (max - min + 1)) + min;
  const a = b * quotient;
  return { display: `${a} ÷ ${b} = ?`, answer: quotient };
}

export default function MathDivision(props) {
  return <MathChallengeBase {...props} defaults={DEFAULTS} generateProblem={generate} challengeType="math_division" />;
}
