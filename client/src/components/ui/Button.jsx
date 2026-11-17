import React from 'react';
import { Loader2 } from 'lucide-react';

const VARIANTS = {
  // Solid gold with a hover sheen
  primary: 'sheen bg-accent text-ink-base font-semibold shadow-[0_6px_18px_-8px_rgba(0,0,0,0.9)] hover:bg-accent-hover',
  secondary: 'bg-white/[0.06] text-fg border border-white/10 hover:bg-white/[0.1] hover:border-white/20',
  ghost: 'text-fg-muted hover:text-fg hover:bg-white/[0.07]',
  outline: 'border border-white/15 text-fg hover:bg-white/[0.07] hover:border-white/25',
  destructive: 'bg-red-500/10 text-red-300 border border-red-400/25 hover:bg-red-500/15'
};

const SIZES = {
  sm: 'h-8 px-3 text-xs gap-1.5 rounded-lg',
  md: 'h-10 px-4 text-sm gap-2 rounded-xl',
  lg: 'h-12 px-6 text-base gap-2.5 rounded-xl'
};

/**
 * ShowTracker button.
 *  - variant: primary | secondary | ghost | outline | destructive
 *  - size: sm | md | lg
 *  - loading: shows a spinner and blocks clicks
 *  - leftIcon / rightIcon: icon components (e.g. from lucide-react)
 *  - as: render as another element/component (e.g. Link) while keeping the styling
 */
const Button = React.forwardRef(function Button(
  { variant = 'secondary', size = 'md', loading = false, leftIcon: LeftIcon, rightIcon: RightIcon, as: Tag = 'button', className = '', disabled, children, ...rest },
  ref
) {
  const isButton = Tag === 'button';
  const blocked = disabled || loading;
  return (
    <Tag
      ref={ref}
      {...(isButton ? { type: rest.type ?? 'button', disabled: blocked } : { 'aria-disabled': blocked || undefined })}
      {...rest}
      className={`inline-flex select-none items-center justify-center whitespace-nowrap transition duration-200 active:scale-[0.97] ${
        blocked ? 'pointer-events-none opacity-50' : ''
      } ${VARIANTS[variant]} ${SIZES[size]} ${className}`}
    >
      {loading ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> : LeftIcon && <LeftIcon className="h-4 w-4" aria-hidden="true" />}
      {children}
      {!loading && RightIcon && <RightIcon className="h-4 w-4" aria-hidden="true" />}
    </Tag>
  );
});

export default Button;
