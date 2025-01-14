import { forwardRef, type InputHTMLAttributes } from 'react';
import { classNames } from '~/utils/classNames';

interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  error?: boolean;
  className?: string;
}

export const Input = forwardRef<HTMLInputElement, InputProps>(({ className, error, ...props }, ref) => {
  return (
    <input
      ref={ref}
      className={classNames(
        'w-full px-3 py-2 bg-bolt-elements-background-depth-1 border rounded-lg transition-colors',
        'focus:outline-none focus:ring-2',
        error
          ? 'border-red-500/50 focus:border-red-500 focus:ring-red-500/20'
          : 'border-bolt-elements-borderColor focus:border-cyan-500 focus:ring-cyan-500/20',
        className,
      )}
      {...props}
    />
  );
});

Input.displayName = 'Input';
