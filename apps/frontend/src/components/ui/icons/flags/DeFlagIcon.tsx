import { FlagIconBase, type FlagIconProps } from './FlagIconBase';

/** Flag of Germany — three equal horizontal bands (black, red, gold). */
export function DeFlagIcon(props: FlagIconProps) {
  return (
    <FlagIconBase {...props}>
      <rect width={30} height={20} rx={2} fill="#FFCE00" />
      <path d="M0 2a2 2 0 0 1 2-2h26a2 2 0 0 1 2 2v4.667H0Z" fill="#000000" />
      <rect y={6.667} width={30} height={6.667} fill="#DD0000" />
    </FlagIconBase>
  );
}
