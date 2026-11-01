import { IllustrationSvg, type IllustrationProps } from './IllustrationSvg';

/** A diaper with a heart print — the diaper area. */
export function DiaperIllustration(props: IllustrationProps) {
  return (
    <IllustrationSvg {...props}>
      <path
        d="M60,10 C88,8 110,28 110,58 C110,90 88,110 58,110 C28,110 10,90 10,60 C10,30 32,12 60,10 Z"
        fill="#d4f4ec"
      />
      <path
        d="M30,52 H90 C90,76 78,94 60,94 C42,94 30,76 30,52 Z"
        fill="#ffffff"
        stroke="#2b2540"
        strokeWidth="3"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M38,82 q4,-3 8,0 M74,82 q4,-3 8,0"
        fill="none"
        stroke="#2b2540"
        strokeWidth="2.5"
        strokeLinecap="round"
        strokeLinejoin="round"
        opacity="0.6"
      />
      <rect
        x="26"
        y="40"
        width="68"
        height="14"
        rx="6"
        fill="#ffffff"
        stroke="#2b2540"
        strokeWidth="3"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <rect
        x="22"
        y="42"
        width="14"
        height="10"
        rx="4"
        fill="#7fd8c6"
        stroke="#2b2540"
        strokeWidth="2.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <rect
        x="84"
        y="42"
        width="14"
        height="10"
        rx="4"
        fill="#7fd8c6"
        stroke="#2b2540"
        strokeWidth="2.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M60,77.3 C57.3,74.9 51,70.8 51,67.1 C51,63.2 54.6,61.1 57.5,61.6 C59.1,61.9 60,63.2 60,64.8 C60,63.2 60.9,61.9 62.5,61.6 C65.4,61.1 69,63.2 69,67.1 C69,70.8 62.7,74.9 60,77.3 Z"
        fill="#ff9fb5"
        stroke="#2b2540"
        strokeWidth="2.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <circle cx="46" cy="62" r="2" fill="#9fe3d5" />
      <circle cx="75" cy="62" r="2" fill="#9fe3d5" />
      <circle cx="52" cy="84" r="1.8" fill="#9fe3d5" />
      <circle cx="68" cy="84" r="1.8" fill="#9fe3d5" />
      <circle
        cx="92"
        cy="24"
        r="7"
        fill="#e9fbff"
        stroke="#2b2540"
        strokeWidth="2.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <circle cx="90" cy="22" r="1.8" fill="#ffffff" />
      <circle
        cx="104"
        cy="38"
        r="4"
        fill="#e9fbff"
        stroke="#2b2540"
        strokeWidth="2.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <circle
        cx="22"
        cy="24"
        r="4.5"
        fill="#e9fbff"
        stroke="#2b2540"
        strokeWidth="2.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M18,66 Q19.7,70.3 24,72 Q19.7,73.7 18,78 Q16.3,73.7 12,72 Q16.3,70.3 18,66 Z"
        fill="#fff3b0"
        stroke="#2b2540"
        strokeWidth="2.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </IllustrationSvg>
  );
}
