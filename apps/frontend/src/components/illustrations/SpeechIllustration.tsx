import { IllustrationSvg, type IllustrationProps } from './IllustrationSvg';

/** Two speech bubbles — the LANGUAGE milestone category. */
export function SpeechIllustration(props: IllustrationProps) {
  return (
    <IllustrationSvg {...props}>
      <path
        d="M60,10 C88,8 110,28 110,58 C110,90 88,110 58,110 C28,110 10,90 10,60 C10,30 32,12 60,10 Z"
        fill="#d5f5f0"
      />
      <path
        d="M22,30 h50 a10,10 0 0 1 10,10 v18 a10,10 0 0 1 -10,10 h-30 l-12,10 v-10 h-8 a10,10 0 0 1 -10,-10 v-18 a10,10 0 0 1 10,-10 Z"
        fill="#ffffff"
        stroke="#2b2540"
        strokeWidth="3"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M36,54.7 C33.9,52.8 29,49.6 29,46.7 C29,43.7 31.8,42.1 34,42.4 C35.3,42.7 36,43.7 36,45 C36,43.7 36.7,42.7 38,42.4 C40.2,42.1 43,43.7 43,46.7 C43,49.6 38.1,52.8 36,54.7 Z"
        fill="#ff8fa3"
        stroke="#2b2540"
        strokeWidth="2.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M50,49 q3.5,-6 7,0 t7,0 t7,0"
        fill="none"
        stroke="#2b2540"
        strokeWidth="3"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M58,62 h34 a9,9 0 0 1 9,9 v12 a9,9 0 0 1 -9,9 h-4 v9 l-11,-9 h-19 a9,9 0 0 1 -9,-9 v-12 a9,9 0 0 1 9,-9 Z"
        fill="#8fe0cf"
        stroke="#2b2540"
        strokeWidth="3"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <circle cx="66" cy="77" r="3" fill="#2b2540" />
      <circle cx="76" cy="77" r="3" fill="#2b2540" />
      <circle cx="86" cy="77" r="3" fill="#2b2540" />
      <path
        d="M100,24 Q101.7,28.3 106,30 Q101.7,31.7 100,36 Q98.3,31.7 94,30 Q98.3,28.3 100,24 Z"
        fill="#fff3b0"
        stroke="#2b2540"
        strokeWidth="2.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </IllustrationSvg>
  );
}
