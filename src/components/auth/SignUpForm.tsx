import { createSignal } from "solid-js";
import { Mail, Lock, UserPlus } from "lucide-solid";
import { FormField } from "@/components/auth/FormField";
import { PasswordToggle } from "@/components/auth/PasswordToggle";
import { SubmitButton } from "@/components/auth/SubmitButton";
import { ServerError } from "@/components/auth/ServerError";

const MIN_PASSWORD_LENGTH = 6;

interface Props {
  serverError?: string | null;
}

interface SignUpErrors {
  email?: string;
  password?: string;
  confirmPassword?: string;
}

export default function SignUpForm({ serverError }: Props) {
  const [email, setEmail] = createSignal("");
  const [password, setPassword] = createSignal("");
  const [confirmPassword, setConfirmPassword] = createSignal("");
  const [showPassword, setShowPassword] = createSignal(false);
  const [showConfirmPassword, setShowConfirmPassword] = createSignal(false);
  const [pending, setPending] = createSignal(false);
  const [errors, setErrors] = createSignal<SignUpErrors>({});

  function validate() {
    const next: SignUpErrors = {};
    const passwordValue = password();
    const confirmPasswordValue = confirmPassword();

    if (!email().trim()) {
      next.email = "Email is required";
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email())) {
      next.email = "Enter a valid email address";
    }

    if (!passwordValue) {
      next.password = "Password is required";
    } else if (passwordValue.length < MIN_PASSWORD_LENGTH) {
      next.password = `Password must be at least ${MIN_PASSWORD_LENGTH} characters`;
    }

    if (!confirmPasswordValue) {
      next.confirmPassword = "Please confirm your password";
    } else if (passwordValue !== confirmPasswordValue) {
      next.confirmPassword = "Passwords do not match";
    }

    setErrors(next);
    return Object.keys(next).length === 0;
  }

  function clearError(field: keyof SignUpErrors) {
    if (!errors()[field]) return;

    setErrors((prev) => ({ ...prev, [field]: undefined }));
  }

  function handleSubmit(event: SubmitEvent) {
    if (!validate()) {
      event.preventDefault();
      return;
    }

    setPending(true);
  }

  function passwordHint() {
    const passwordValue = password();
    const remaining = MIN_PASSWORD_LENGTH - passwordValue.length;
    if (errors().password || passwordValue.length === 0 || remaining <= 0) return undefined;

    return (
      <p class="mt-1 text-xs text-blue-100/50">
        {remaining} more character
        {remaining !== 1 ? "s" : ""} needed
      </p>
    );
  }

  return (
    <form method="post" action="/api/auth/signup" class="space-y-4" onSubmit={handleSubmit} noValidate>
      <FormField
        id="email"
        type="email"
        label="Email"
        value={email()}
        onChange={(v) => {
          setEmail(v);
          clearError("email");
        }}
        placeholder="you@example.com"
        error={errors().email}
        icon={<Mail class="size-4" />}
      />

      <FormField
        id="password"
        label="Password"
        type={showPassword() ? "text" : "password"}
        value={password()}
        onChange={(v) => {
          setPassword(v);
          clearError("password");
        }}
        placeholder="Min. 6 characters"
        error={errors().password}
        hint={passwordHint()}
        icon={<Lock class="size-4" />}
        endContent={
          <PasswordToggle
            visible={showPassword()}
            onToggle={() => {
              setShowPassword(!showPassword());
            }}
          />
        }
      />

      <FormField
        id="confirmPassword"
        name="confirmPassword"
        label="Confirm password"
        type={showConfirmPassword() ? "text" : "password"}
        value={confirmPassword()}
        onChange={(v) => {
          setConfirmPassword(v);
          clearError("confirmPassword");
        }}
        placeholder="Re-enter your password"
        error={errors().confirmPassword}
        icon={<Lock class="size-4" />}
        endContent={
          <PasswordToggle
            visible={showConfirmPassword()}
            onToggle={() => {
              setShowConfirmPassword(!showConfirmPassword());
            }}
          />
        }
      />

      <ServerError message={serverError} />

      <SubmitButton pending={pending()} pendingText="Creating account..." icon={<UserPlus class="size-4" />}>
        Create account
      </SubmitButton>
    </form>
  );
}
