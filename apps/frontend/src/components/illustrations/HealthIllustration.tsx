import { IllustrationSvg, type IllustrationProps } from './IllustrationSvg';

/** A heart with a plaster — the medication & vaccination area. */
export function HealthIllustration(props: IllustrationProps) {
  return (
    <IllustrationSvg {...props}>
      <path
        d="M60,10 C88,8 110,28 110,58 C110,90 88,110 58,110 C28,110 10,90 10,60 C10,30 32,12 60,10 Z"
        fill="#ffe1e6"
      />
      <path
        d="M60,91.2 C49.2,81.4 24,65.2 24,50.3 C24,34.8 38.4,26.4 49.9,28.3 C56.4,29.6 60,34.8 60,41.3 C60,34.8 63.6,29.6 70.1,28.3 C81.6,26.4 96,34.8 96,50.3 C96,65.2 70.8,81.4 60,91.2 Z"
        fill="#ff8fa3"
        stroke="#2b2540"
        strokeWidth="3"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <g transform="rotate(-38 76 44)">
        <rect
          x="58"
          y="37"
          width="36"
          height="14"
          rx="7"
          fill="#ffd9ad"
          stroke="#2b2540"
          strokeWidth="3"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        <rect
          x="70"
          y="37"
          width="12"
          height="14"
          fill="#f5bd8a"
          stroke="#2b2540"
          strokeWidth="2.5"
        />
        <circle cx="63" cy="42" r="1.1" fill="#2b2540" />
        <circle cx="63" cy="46.5" r="1.1" fill="#2b2540" />
        <circle cx="88.5" cy="42" r="1.1" fill="#2b2540" />
        <circle cx="88.5" cy="46.5" r="1.1" fill="#2b2540" />
      </g>
      <circle cx="48.3" cy="70" r="2.3" fill="#2b2540" />
      <circle cx="59.7" cy="70" r="2.3" fill="#2b2540" />
      <circle cx="49.1" cy="69.1" r="0.8" fill="#ffffff" />
      <circle cx="60.5" cy="69.1" r="0.8" fill="#ffffff" />
      <ellipse cx="44.5" cy="74.8" rx="3" ry="2.1" fill="#ff6f8a" opacity="0.8" />
      <ellipse cx="63.5" cy="74.8" rx="3" ry="2.1" fill="#ff6f8a" opacity="0.8" />
      <path
        d="M50.7,74.3 q3.3,3.3 6.6,0"
        fill="none"
        stroke="#2b2540"
        strokeWidth="2.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M98,80 v12 M92,86 h12"
        fill="none"
        stroke="#ff6f8a"
        strokeWidth="4"
        strokeLinecap="round"
      />
      <path
        d="M20,28 Q21.7,32.3 26,34 Q21.7,35.7 20,40 Q18.3,35.7 14,34 Q18.3,32.3 20,28 Z"
        fill="#ffffff"
        stroke="#2b2540"
        strokeWidth="2.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <circle cx="24" cy="96" r="3" fill="#ffb3c1" />
    </IllustrationSvg>
  );
}
