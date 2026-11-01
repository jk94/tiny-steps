import { IllustrationSvg, type IllustrationProps } from './IllustrationSvg';

/** Stacked ABC blocks — the development calendar. */
export function DevelopmentIllustration(props: IllustrationProps) {
  return (
    <IllustrationSvg {...props}>
      <path
        d="M60,10 C88,8 110,28 110,58 C110,90 88,110 58,110 C28,110 10,90 10,60 C10,30 32,12 60,10 Z"
        fill="#d9efff"
      />
      <path
        d="M26,66 l8.4,-8.4 h30 v30 l-8.4,8.4 Z"
        fill="#e57e8f"
        stroke="#2b2540"
        strokeWidth="3"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <rect
        x="26"
        y="66"
        width="30"
        height="30"
        rx="3"
        fill="#ff9fae"
        stroke="#2b2540"
        strokeWidth="3"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M35,89 L41,73 L47,89 M37.5,83.5 H44.5"
        fill="none"
        stroke="#2b2540"
        strokeWidth="3"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M60,66 l8.4,-8.4 h30 v30 l-8.4,8.4 Z"
        fill="#76b6ea"
        stroke="#2b2540"
        strokeWidth="3"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <rect
        x="60"
        y="66"
        width="30"
        height="30"
        rx="3"
        fill="#9fd3ff"
        stroke="#2b2540"
        strokeWidth="3"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M70,73 V89 H76 a4,4 0 0 0 0,-8 H70 M70,81 H75 a4,4 0 0 0 0,-8 H70"
        fill="none"
        stroke="#2b2540"
        strokeWidth="3"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M43,32 l8.4,-8.4 h30 v30 l-8.4,8.4 Z"
        fill="#f0c55c"
        stroke="#2b2540"
        strokeWidth="3"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <rect
        x="43"
        y="32"
        width="30"
        height="30"
        rx="3"
        fill="#ffe08a"
        stroke="#2b2540"
        strokeWidth="3"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M63,41 A8,8 0 1 0 63,53"
        fill="none"
        stroke="#2b2540"
        strokeWidth="3"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M94,23 Q96,28 101,30 Q96,32 94,37 Q92,32 87,30 Q92,28 94,23 Z"
        fill="#fff3b0"
        stroke="#2b2540"
        strokeWidth="2.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <circle cx="22" cy="40" r="3" fill="#a9d8ff" />
      <circle cx="100" cy="56" r="2.5" fill="#a9d8ff" />
    </IllustrationSvg>
  );
}
