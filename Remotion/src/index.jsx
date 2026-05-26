import {registerRoot} from 'remotion';
// IMPORTANT: Import explicitly from Root.jsx.
// We also have a `Root.tsx` entry used by the loan reminder render path.
// Importing from `./Root` can resolve to `Root.tsx`, which does not export `RemotionRoot`,
// causing `registerRoot()` to receive `undefined`.
import {RemotionRoot} from './Root.jsx';

registerRoot(RemotionRoot);
