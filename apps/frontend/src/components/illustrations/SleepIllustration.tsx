import { IllustrationSvg, type IllustrationProps } from './IllustrationSvg';

/** A sleepy crescent moon with stars — the sleep area. */
export function SleepIllustration(props: IllustrationProps) {
  return (
    <IllustrationSvg {...props}>
      <path
        d="M60,10 C88,8 110,28 110,58 C110,90 88,110 58,110 C28,110 10,90 10,60 C10,30 32,12 60,10 Z"
        fill="#e7e0ff"
      />
      <path
        d="M55.2,30 A32,32 0 1 0 86.8,70.6 A26,26 0 1 1 55.2,30 Z"
        fill="#ffe08a"
        stroke="#2b2540"
        strokeWidth="3"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M35.4,66 q2.8,2.8 5.7,0"
        fill="none"
        stroke="#2b2540"
        strokeWidth="2.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M46.9,66 q2.8,2.8 5.7,0"
        fill="none"
        stroke="#2b2540"
        strokeWidth="2.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <ellipse cx="34.5" cy="70.8" rx="3" ry="2.1" fill="#ff9fb5" opacity="0.8" />
      <ellipse cx="53.5" cy="70.8" rx="3" ry="2.1" fill="#ff9fb5" opacity="0.8" />
      <path
        d="M40.7,70.3 q3.3,3.3 6.6,0"
        fill="none"
        stroke="#2b2540"
        strokeWidth="2.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M88,63 L90.4,68.8 L96.6,69.2 L91.8,73.2 L93.3,79.3 L88,76 L82.7,79.3 L84.2,73.2 L79.4,69.2 L85.6,68.8 Z"
        fill="#fff3b0"
        stroke="#2b2540"
        strokeWidth="2.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M28,22 L29.6,25.7 L33.7,26.1 L30.7,28.9 L31.5,32.9 L28,30.8 L24.5,32.9 L25.3,28.9 L22.3,26.1 L26.4,25.7 Z"
        fill="#fff3b0"
        stroke="#2b2540"
        strokeWidth="2.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M80,28 h9 l-9,10 h9"
        fill="none"
        stroke="#7b68ee"
        strokeWidth="3"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M93,17 h6 l-6,7 h6"
        fill="none"
        stroke="#7b68ee"
        strokeWidth="2.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <circle cx="98" cy="96" r="2.5" fill="#c9bcff" />
      <circle cx="20" cy="90" r="3" fill="#c9bcff" />
    </IllustrationSvg>
  );
}
