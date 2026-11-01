import { IllustrationSvg, type IllustrationProps } from './IllustrationSvg';

/** A smiling baby bottle — the feeding area. */
export function FeedingIllustration(props: IllustrationProps) {
  return (
    <IllustrationSvg {...props}>
      <path
        d="M60,10 C88,8 110,28 110,58 C110,90 88,110 58,110 C28,110 10,90 10,60 C10,30 32,12 60,10 Z"
        fill="#ffe3cc"
      />
      <circle cx="22" cy="84" r="3" fill="#ffc59e" />
      <circle cx="98" cy="40" r="2.5" fill="#ffc59e" />
      <g transform="rotate(-14 60 62)">
        <path
          d="M50,38 C50,27 54,19 60,19 C66,19 70,27 70,38 Z"
          fill="#ffd59e"
          stroke="#2b2540"
          strokeWidth="3"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        <path
          d="M57,21 C57,17 63,17 63,21"
          fill="#ffd59e"
          stroke="#2b2540"
          strokeWidth="2.5"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        <rect
          x="40"
          y="36"
          width="40"
          height="11"
          rx="4"
          fill="#ff9fb5"
          stroke="#2b2540"
          strokeWidth="3"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        <rect x="43" y="47" width="34" height="50" rx="11" fill="#e4f4ff" />
        <path
          d="M43,67 q8.5,-5 17,0 t17,0 V86 a11,11 0 0 1 -11,11 H54 a11,11 0 0 1 -11,-11 Z"
          fill="#ffffff"
        />
        <rect
          x="43"
          y="47"
          width="34"
          height="50"
          rx="11"
          fill="none"
          stroke="#2b2540"
          strokeWidth="3"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        <path
          d="M48,55 h5 M48,62 h3"
          fill="none"
          stroke="#2b2540"
          strokeWidth="2"
          strokeLinecap="round"
          opacity="0.5"
        />
        <circle cx="54.6" cy="76" r="2.2" fill="#2b2540" />
        <circle cx="65.4" cy="76" r="2.2" fill="#2b2540" />
        <circle cx="55.3" cy="75.2" r="0.7" fill="#ffffff" />
        <circle cx="66.1" cy="75.2" r="0.7" fill="#ffffff" />
        <ellipse cx="51" cy="80.5" rx="2.9" ry="2" fill="#ff9fb5" opacity="0.8" />
        <ellipse cx="69" cy="80.5" rx="2.9" ry="2" fill="#ff9fb5" opacity="0.8" />
        <path
          d="M56.9,80 q3.1,3.1 6.3,0"
          fill="none"
          stroke="#2b2540"
          strokeWidth="2.5"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </g>
      <path
        d="M89,26 q5,7 0,10.5 q-5,-3.5 0,-10.5 Z"
        fill="#bfe6ff"
        stroke="#2b2540"
        strokeWidth="2.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M97,40 q3.5,5 0,7.5 q-3.5,-2.5 0,-7.5 Z"
        fill="#bfe6ff"
        stroke="#2b2540"
        strokeWidth="2.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M26,27 Q28,32 33,34 Q28,36 26,41 Q24,36 19,34 Q24,32 26,27 Z"
        fill="#fff3b0"
        stroke="#2b2540"
        strokeWidth="2.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </IllustrationSvg>
  );
}
