// src/common/components/ds/index.ts
/**
 * The design system's public surface. Product code imports from here (or from
 * `form/`) and NEVER from `ui/` — `ui/` holds unbranded, regenerable primitives,
 * so anything importing them directly gets silently restyled by a regeneration
 * with no file left to intercept it. Lint enforces this; the barrel makes doing
 * the right thing shorter than doing the wrong one.
 */
export { Button, type ButtonProps } from './Button';
export { Checkbox, type CheckboxProps } from './Checkbox';
export { Dialog, DialogClose, DialogTrigger, type DialogProps } from './Dialog';
export { Field, type FieldProps } from './Field';
export { Input, type InputProps } from './Input';
export { Label, type LabelProps } from './Label';
export { Select, type SelectOption, type SelectProps } from './Select';
export { Table, type TableColumn, type TableProps } from './Table';
export { Textarea, type TextareaProps } from './Textarea';
