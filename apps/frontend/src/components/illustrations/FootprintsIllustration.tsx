import { IllustrationSvg, type IllustrationProps } from './IllustrationSvg';

/** Two baby footprints — the MOTOR milestone category. */
export function FootprintsIllustration(props: IllustrationProps) {
  return (
    <IllustrationSvg {...props}>
      <path
        d="M60,10 C88,8 110,28 110,58 C110,90 88,110 58,110 C28,110 10,90 10,60 C10,30 32,12 60,10 Z"
        fill="#e0e4ff"
      />
      <g transform="translate(44 76) rotate(-18) scale(1.5)">
        <path
          d="M0,-6 C7,-6 9,4 7,12 C5,19 -5,19 -7,12 C-9,4 -7,-6 0,-6 Z"
          fill="#ffc2d4"
          stroke="#2b2540"
          strokeWidth="2.5"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        <circle
          cx="-6"
          cy="-12"
          r="2.6"
          fill="#ffc2d4"
          stroke="#2b2540"
          strokeWidth="2.5"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        <circle
          cx="-1.5"
          cy="-15"
          r="2.8"
          fill="#ffc2d4"
          stroke="#2b2540"
          strokeWidth="2.5"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        <circle
          cx="3.5"
          cy="-14.5"
          r="2.5"
          fill="#ffc2d4"
          stroke="#2b2540"
          strokeWidth="2.5"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        <circle
          cx="7.5"
          cy="-11"
          r="2.1"
          fill="#ffc2d4"
          stroke="#2b2540"
          strokeWidth="2.5"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </g>
      <g transform="translate(76 52) rotate(14) scale(1.5)">
        <path
          d="M0,-6 C7,-6 9,4 7,12 C5,19 -5,19 -7,12 C-9,4 -7,-6 0,-6 Z"
          fill="#ffc2d4"
          stroke="#2b2540"
          strokeWidth="2.5"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        <circle
          cx="-6"
          cy="-12"
          r="2.6"
          fill="#ffc2d4"
          stroke="#2b2540"
          strokeWidth="2.5"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        <circle
          cx="-1.5"
          cy="-15"
          r="2.8"
          fill="#ffc2d4"
          stroke="#2b2540"
          strokeWidth="2.5"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        <circle
          cx="3.5"
          cy="-14.5"
          r="2.5"
          fill="#ffc2d4"
          stroke="#2b2540"
          strokeWidth="2.5"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        <circle
          cx="7.5"
          cy="-11"
          r="2.1"
          fill="#ffc2d4"
          stroke="#2b2540"
          strokeWidth="2.5"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </g>
      <path
        d="M22,46 q6,-4 12,0 M18,56 q6,-4 12,0"
        fill="none"
        stroke="#2b2540"
        strokeWidth="2.5"
        strokeLinecap="round"
        strokeLinejoin="round"
        opacity="0.5"
      />
      <path
        d="M98,82 Q99.7,86.3 104,88 Q99.7,89.7 98,94 Q96.3,89.7 92,88 Q96.3,86.3 98,82 Z"
        fill="#fff3b0"
        stroke="#2b2540"
        strokeWidth="2.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M30,17 Q31.4,20.6 35,22 Q31.4,23.4 30,27 Q28.6,23.4 25,22 Q28.6,20.6 30,17 Z"
        fill="#ffffff"
        stroke="#2b2540"
        strokeWidth="2.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </IllustrationSvg>
  );
}
