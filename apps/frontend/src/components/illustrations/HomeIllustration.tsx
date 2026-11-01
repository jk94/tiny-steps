import { IllustrationSvg, type IllustrationProps } from './IllustrationSvg';

/** A little house with a heart window — households. */
export function HomeIllustration(props: IllustrationProps) {
  return (
    <IllustrationSvg {...props}>
      <path
        d="M60,10 C88,8 110,28 110,58 C110,90 88,110 58,110 C28,110 10,90 10,60 C10,30 32,12 60,10 Z"
        fill="#e4ecff"
      />
      <path
        d="M16,40 a7,7 0 0 1 4,-12 a9,9 0 0 1 16,-3 a7,7 0 0 1 8,8 a6,6 0 0 1 -2,7 Z"
        fill="#ffffff"
        stroke="#2b2540"
        strokeWidth="2.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <rect
        x="72"
        y="28"
        width="10"
        height="18"
        rx="2"
        fill="#ffb59e"
        stroke="#2b2540"
        strokeWidth="3"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <rect
        x="36"
        y="56"
        width="52"
        height="44"
        rx="4"
        fill="#fff6e5"
        stroke="#2b2540"
        strokeWidth="3"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M28,60 L62,30 L96,60 Z"
        fill="#ff9f7f"
        stroke="#2b2540"
        strokeWidth="3"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <rect
        x="54"
        y="74"
        width="16"
        height="26"
        rx="8"
        fill="#9b8cff"
        stroke="#2b2540"
        strokeWidth="3"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <circle cx="66" cy="88" r="1.6" fill="#2b2540" />
      <path
        d="M62,52.9 C60.2,51.2 56,48.5 56,46.1 C56,43.5 58.4,42.1 60.3,42.4 C61.4,42.6 62,43.5 62,44.5 C62,43.5 62.6,42.6 63.7,42.4 C65.6,42.1 68,43.5 68,46.1 C68,48.5 63.8,51.2 62,52.9 Z"
        fill="#ff8fa3"
        stroke="#2b2540"
        strokeWidth="2.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <rect
        x="40"
        y="66"
        width="10"
        height="10"
        rx="2"
        fill="#bfe6ff"
        stroke="#2b2540"
        strokeWidth="2.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <rect
        x="74"
        y="66"
        width="10"
        height="10"
        rx="2"
        fill="#bfe6ff"
        stroke="#2b2540"
        strokeWidth="2.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M100,18 Q101.7,22.3 106,24 Q101.7,25.7 100,30 Q98.3,25.7 94,24 Q98.3,22.3 100,18 Z"
        fill="#fff3b0"
        stroke="#2b2540"
        strokeWidth="2.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M26,100 H96"
        fill="none"
        stroke="#2b2540"
        strokeWidth="3"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </IllustrationSvg>
  );
}
