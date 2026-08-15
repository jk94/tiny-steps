import { useState, type HTMLAttributes } from 'react';
import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from '../../lib/cn';

const avatarVariants = cva(
  'inline-flex shrink-0 items-center justify-center overflow-hidden rounded-full bg-muted font-medium text-muted-foreground select-none',
  {
    variants: {
      size: {
        sm: 'h-8 w-8 text-xs',
        md: 'h-10 w-10 text-sm',
        lg: 'h-14 w-14 text-lg',
      },
    },
    defaultVariants: {
      size: 'md',
    },
  },
);

/** Derives up-to-two-letter initials from a display name. */
function initialsFrom(name: string): string {
  const words = name.trim().split(/\s+/).filter(Boolean);
  if (words.length === 0) {
    return '?';
  }
  if (words.length === 1) {
    return words[0].slice(0, 2).toUpperCase();
  }
  return (words[0][0] + words[words.length - 1][0]).toUpperCase();
}

export interface AvatarProps
  extends HTMLAttributes<HTMLSpanElement>, VariantProps<typeof avatarVariants> {
  /** Image URL; when absent or it fails to load, initials are shown instead. */
  src?: string;
  /** Display name — used for the image `alt`, the initials fallback, and the
   * fallback's accessible label. */
  name: string;
}

/**
 * Circular user/child avatar: shows `src` when it loads, otherwise an
 * initials-from-`name` fallback. The fallback is exposed as `role="img"` with
 * `name` as its accessible label so it announces identically to the image.
 */
export function Avatar({ src, name, size, className, ...props }: AvatarProps) {
  const [failed, setFailed] = useState(false);
  const showImage = Boolean(src) && !failed;

  return (
    <span
      className={cn(avatarVariants({ size }), className)}
      {...(showImage ? {} : { role: 'img', 'aria-label': name })}
      {...props}
    >
      {showImage ? (
        <img
          src={src}
          alt={name}
          className="h-full w-full object-cover"
          onError={() => setFailed(true)}
        />
      ) : (
        <span aria-hidden="true">{initialsFrom(name)}</span>
      )}
    </span>
  );
}
