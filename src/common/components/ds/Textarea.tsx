// src/common/components/ds/Textarea.tsx
'use client';
import * as React from 'react';
import { BaseTextarea } from '@/common/components/ui/textarea';
import { textareaVariants, type TextareaVariantProps } from '@/common/components/variants/textarea';
import { cn } from '@/common/lib/utils';

export interface TextareaProps
  extends Omit<React.ComponentProps<typeof BaseTextarea>, 'className'>, TextareaVariantProps {
  error?: React.ReactNode;
  className?: string;
}

export const Textarea = React.forwardRef<HTMLTextAreaElement, TextareaProps>(
  ({ error, className, variant, resize, ...props }, ref) => (
    <BaseTextarea
      ref={ref}
      aria-invalid={error ? true : (props['aria-invalid'] ?? undefined)}
      className={cn(textareaVariants({ variant: error ? 'error' : variant, resize }), className)}
      {...props}
    />
  ),
);
Textarea.displayName = 'Textarea';
