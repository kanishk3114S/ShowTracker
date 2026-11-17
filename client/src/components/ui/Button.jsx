import React from 'react';
import { Loader2 } from 'lucide-react';

const VARIANTS = {
  primary: 'bg-copper text-ink-base font-semibold hover:bg-copper-hover shadow-sm shadow-black/30',
  secondary: 'bg-ink-raised text-fg border border-ink-edge hover:bg-[#1f2838] hover:border-[#3b455e]',
  ghost: 'text-fg-muted hover:text-fg hover:bg-ink-raised',
  outline: 'border border-ink-edge text-fg hover:bg-ink-raised hover:border-[#3b455e]',
  destructive: 'bg-vermilion/10 text-[#ff7b7b] border border-vermilion/40 hover:bg-vermilion/20'
};

const SIZES = {
  sm: 'h-8 px-3 text-xs gap-1.5 rounded-lg',
  md: 'h-10 px-4 text-sm gap-2 rounded-lg',
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
      className={`inline-flex select-none items-center justify-center whitespace-nowrap transition duration-150 active:scale-[0.97] ${
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
