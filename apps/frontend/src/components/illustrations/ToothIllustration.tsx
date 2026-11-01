import { IllustrationSvg, type IllustrationProps } from './IllustrationSvg';

/** A smiling milk tooth — the PHYSICAL milestone category. */
export function ToothIllustration(props: IllustrationProps) {
  return (
    <IllustrationSvg {...props}>
      <path
        d="M60,10 C88,8 110,28 110,58 C110,90 88,110 58,110 C28,110 10,90 10,60 C10,30 32,12 60,10 Z"
        fill="#ffe1e8"
      />
      <path
        d="M40,34 C48,26 54,32 60,32 C66,32 72,26 80,34 C88,42 84,56 80,64 C77,72 77,92 70,94 C64,96 64,78 60,78 C56,78 56,96 50,94 C43,92 43,72 40,64 C36,56 32,42 40,34 Z"
        fill="#ffffff"
        stroke="#2b2540"
        strokeWidth="3"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M46,40 q4,-3 8,0"
        fill="none"
        stroke="#d9d4ea"
        strokeWidth="3"
        strokeLinecap="round"
      />
      <circle cx="54.9" cy="54" r="2" fill="#2b2540" />
      <circle cx="65.1" cy="54" r="2" fill="#2b2540" />
      <circle cx="55.6" cy="53.2" r="0.7" fill="#ffffff" />
      <circle cx="65.8" cy="53.2" r="0.7" fill="#ffffff" />
      <ellipse cx="51.5" cy="58.2" rx="2.7" ry="1.9" fill="#ff9fb5" opacity="0.8" />
      <ellipse cx="68.5" cy="58.2" rx="2.7" ry="1.9" fill="#ff9fb5" opacity="0.8" />
      <path
        d="M57,57.8 q3,3 6,0"
        fill="none"
        stroke="#2b2540"
        strokeWidth="2.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M94,22 Q96.2,27.8 102,30 Q96.2,32.2 94,38 Q91.8,32.2 86,30 Q91.8,27.8 94,22 Z"
        fill="#fff3b0"
        stroke="#2b2540"
        strokeWidth="2.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M24,75 Q25.4,78.6 29,80 Q25.4,81.4 24,85 Q22.6,81.4 19,80 Q22.6,78.6 24,75 Z"
        fill="#ffffff"
        stroke="#2b2540"
        strokeWidth="2.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <circle cx="98" cy="70" r="3" fill="#ffb3c1" />
    </IllustrationSvg>
  );
}
