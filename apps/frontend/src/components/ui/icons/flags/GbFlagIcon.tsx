import { FlagIconBase, type FlagIconProps } from './FlagIconBase';

/**
 * Union Flag of the United Kingdom, marking English. Deliberately the UK flag
 * rather than the US one. Simplified: the diagonal saltire arms are drawn as
 * plain (non-counterchanged) strokes, which reads correctly at the ~21×14px
 * size this is rendered at.
 */
export function GbFlagIcon(props: FlagIconProps) {
  return (
    <FlagIconBase {...props}>
      <rect width={30} height={20} rx={2} fill="#012169" />
      {/* White saltire (diagonals), then the narrower red diagonals on top. */}
      <path d="M0 0 30 20M30 0 0 20" stroke="#FFFFFF" strokeWidth={4} />
      <path d="M0 0 30 20M30 0 0 20" stroke="#C8102E" strokeWidth={1.6} />
      {/* White cross, then the red cross of St George on top. */}
      <path d="M15 0v20M0 10h30" stroke="#FFFFFF" strokeWidth={6.6} />
      <path d="M15 0v20M0 10h30" stroke="#C8102E" strokeWidth={4} />
    </FlagIconBase>
  );
}
