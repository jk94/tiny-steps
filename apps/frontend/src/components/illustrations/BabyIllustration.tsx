import { IllustrationSvg, type IllustrationProps } from './IllustrationSvg';

/** A happy baby face — the app mascot (login, empty states, hero). */
export function BabyIllustration(props: IllustrationProps) {
  return (
    <IllustrationSvg {...props}>
      <path
        d="M60,10 C88,8 110,28 110,58 C110,90 88,110 58,110 C28,110 10,90 10,60 C10,30 32,12 60,10 Z"
        fill="#fff0c2"
      />
      <circle
        cx="31"
        cy="64"
        r="8"
        fill="#ffd2b3"
        stroke="#2b2540"
        strokeWidth="3"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <circle
        cx="89"
        cy="64"
        r="8"
        fill="#ffd2b3"
        stroke="#2b2540"
        strokeWidth="3"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <circle
        cx="60"
        cy="64"
        r="30"
        fill="#ffdcc4"
        stroke="#2b2540"
        strokeWidth="3"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M58,35 C52,28 58,20 65,24 C70,27 66,33 62,31"
        fill="none"
        stroke="#2b2540"
        strokeWidth="3"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M46,61 q5,-6 10,0 M64,61 q5,-6 10,0"
        fill="none"
        stroke="#2b2540"
        strokeWidth="3"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <ellipse cx="43" cy="71" rx="5" ry="3.3" fill="#ff9fb5" opacity="0.8" />
      <ellipse cx="77" cy="71" rx="5" ry="3.3" fill="#ff9fb5" opacity="0.8" />
      <path
        d="M53,73 q7,9 14,0 Z"
        fill="#ff8a8a"
        stroke="#2b2540"
        strokeWidth="2.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M98,19 Q100,24 105,26 Q100,28 98,33 Q96,28 91,26 Q96,24 98,19 Z"
        fill="#ffffff"
        stroke="#2b2540"
        strokeWidth="2.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M20,25 Q21.4,28.6 25,30 Q21.4,31.4 20,35 Q18.6,31.4 15,30 Q18.6,28.6 20,25 Z"
        fill="#ffffff"
        stroke="#2b2540"
        strokeWidth="2.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <circle cx="100" cy="96" r="3" fill="#ffd77a" />
      <circle cx="22" cy="98" r="2.5" fill="#ffd77a" />
    </IllustrationSvg>
  );
}
