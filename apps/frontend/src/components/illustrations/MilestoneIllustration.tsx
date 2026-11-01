import { IllustrationSvg, type IllustrationProps } from './IllustrationSvg';

/** A beaming star with baby footprints — milestones without a more specific category. */
export function MilestoneIllustration(props: IllustrationProps) {
  return (
    <IllustrationSvg {...props}>
      <path
        d="M60,10 C88,8 110,28 110,58 C110,90 88,110 58,110 C28,110 10,90 10,60 C10,30 32,12 60,10 Z"
        fill="#ffe0ef"
      />
      <path
        d="M64,18 L73.4,39.1 L96.3,41.5 L79.2,56.9 L84,79.5 L64,68 L44,79.5 L48.8,56.9 L31.7,41.5 L54.6,39.1 Z"
        fill="#ffd84d"
        stroke="#2b2540"
        strokeWidth="3"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <circle cx="58" cy="54" r="2.4" fill="#2b2540" />
      <circle cx="70" cy="54" r="2.4" fill="#2b2540" />
      <circle cx="58.8" cy="53.1" r="0.8" fill="#ffffff" />
      <circle cx="70.8" cy="53.1" r="0.8" fill="#ffffff" />
      <ellipse cx="54" cy="59" rx="3.2" ry="2.2" fill="#ff9fb5" opacity="0.8" />
      <ellipse cx="74" cy="59" rx="3.2" ry="2.2" fill="#ff9fb5" opacity="0.8" />
      <path
        d="M60.5,58.5 q3.5,3.5 7,0"
        fill="none"
        stroke="#2b2540"
        strokeWidth="2.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <g transform="translate(24 94) rotate(-20) scale(0.8)">
        <path
          d="M0,-6 C7,-6 9,4 7,12 C5,19 -5,19 -7,12 C-9,4 -7,-6 0,-6 Z"
          fill="#ffb3c7"
          stroke="#2b2540"
          strokeWidth="2.5"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        <circle
          cx="-6"
          cy="-12"
          r="2.6"
          fill="#ffb3c7"
          stroke="#2b2540"
          strokeWidth="2.5"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        <circle
          cx="-1.5"
          cy="-15"
          r="2.8"
          fill="#ffb3c7"
          stroke="#2b2540"
          strokeWidth="2.5"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        <circle
          cx="3.5"
          cy="-14.5"
          r="2.5"
          fill="#ffb3c7"
          stroke="#2b2540"
          strokeWidth="2.5"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        <circle
          cx="7.5"
          cy="-11"
          r="2.1"
          fill="#ffb3c7"
          stroke="#2b2540"
          strokeWidth="2.5"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </g>
      <g transform="translate(40 80) rotate(12) scale(0.8)">
        <path
          d="M0,-6 C7,-6 9,4 7,12 C5,19 -5,19 -7,12 C-9,4 -7,-6 0,-6 Z"
          fill="#ffb3c7"
          stroke="#2b2540"
          strokeWidth="2.5"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        <circle
          cx="-6"
          cy="-12"
          r="2.6"
          fill="#ffb3c7"
          stroke="#2b2540"
          strokeWidth="2.5"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        <circle
          cx="-1.5"
          cy="-15"
          r="2.8"
          fill="#ffb3c7"
          stroke="#2b2540"
          strokeWidth="2.5"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        <circle
          cx="3.5"
          cy="-14.5"
          r="2.5"
          fill="#ffb3c7"
          stroke="#2b2540"
          strokeWidth="2.5"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        <circle
          cx="7.5"
          cy="-11"
          r="2.1"
          fill="#ffb3c7"
          stroke="#2b2540"
          strokeWidth="2.5"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </g>
      <path
        d="M100,17 Q102,22 107,24 Q102,26 100,31 Q98,26 93,24 Q98,22 100,17 Z"
        fill="#ffffff"
        stroke="#2b2540"
        strokeWidth="2.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M22,25 Q23.4,28.6 27,30 Q23.4,31.4 22,35 Q20.6,31.4 17,30 Q20.6,28.6 22,25 Z"
        fill="#fff3b0"
        stroke="#2b2540"
        strokeWidth="2.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <circle cx="102" cy="90" r="3" fill="#ffb3d1" />
      <circle cx="94" cy="102" r="2" fill="#ffb3d1" />
    </IllustrationSvg>
  );
}
