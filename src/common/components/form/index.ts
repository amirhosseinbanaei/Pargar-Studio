// src/common/components/form/index.ts
/**
 * The form-bound tier. Product code inside a `<Form>` imports these; they bind
 * a `ds/` control to react-hook-form and render its label, description and
 * message with the id wiring already correct.
 *
 * How a feature component assembles them — schema, `useForm`, `defaultValues`,
 * the submit handler, and mapping a server's field-keyed errors back onto
 * inputs with `applyFieldErrors` — is `references/07-forms.md` §3, not this
 * layer's business.
 */
export {
  Form,
  FormField,
  FormItem,
  FormControl,
  FormLabel,
  FormDescription,
  FormMessage,
  useFormField,
} from './Form';
export { FormInput, type FormInputProps } from './FormInput';
export { FormTextarea, type FormTextareaProps } from './FormTextarea';
export { FormSelect, type FormSelectProps } from './FormSelect';
export { FormCheckbox, type FormCheckboxProps } from './FormCheckbox';
export { FormButton, type FormButtonProps } from './FormButton';
