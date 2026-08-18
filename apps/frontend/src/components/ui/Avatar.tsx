import type { ComponentPropsWithoutRef } from 'react';
import { cva, type VariantProps } from 'class-variance-authority';
import { Avatar as AvatarPrimitive } from 'radix-ui';
import { cn } from '../../lib/cn';

const avatarVariants = cva(
  'relative inline-flex shrink-0 items-center justify-center overflow-hidden rounded-full font-medium select-none',
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
  extends
    Omit<ComponentPropsWithoutRef<typeof AvatarPrimitive.Root>, 'children'>,
    VariantProps<typeof avatarVariants> {
  /** Image URL; when absent or it fails to load, initials are shown instead. */
  src?: string;
  /** Display name — used for the image `alt`, the initials fallback, and the
   * fallback's accessible label. */
  name: string;
}

/**
 * Circular user/child avatar: shows `src` when it loads, otherwise an
 * initials-from-`name` fallback. Built on Radix's Avatar primitive, which owns
 * the image load/error state machine (the `<img>` is only committed to the DOM
 * once the browser has actually decoded it, so there is never a broken-image
 * flash). The fallback is exposed as `role="img"` with `name` as its accessible
 * label so it announces identically to the image.
 */
export function Avatar({ src, name, size, className, ...props }: AvatarProps) {
  return (
    <AvatarPrimitive.Root
      data-slot="avatar"
      className={cn(avatarVariants({ size }), className)}
      {...props}
    >
      {src && (
        <AvatarPrimitive.Image
          data-slot="avatar-image"
          src={src}
          alt={name}
          className="aspect-square size-full object-cover"
        />
      )}
      <AvatarPrimitive.Fallback
        data-slot="avatar-fallback"
        role="img"
        aria-label={name}
        className="flex size-full items-center justify-center rounded-full bg-muted text-muted-foreground"
      >
        <span aria-hidden="true">{initialsFrom(name)}</span>
      </AvatarPrimitive.Fallback>
    </AvatarPrimitive.Root>
  );
}
