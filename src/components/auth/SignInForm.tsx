import { createSignal } from "solid-js";
import { Mail, Lock, LogIn } from "lucide-solid";
import { FormField } from "@/components/auth/FormField";
import { PasswordToggle } from "@/components/auth/PasswordToggle";
import { SubmitButton } from "@/components/auth/SubmitButton";
import { ServerError } from "@/components/auth/ServerError";

interface Props {
  serverError?: string | null;
}

interface SignInErrors {
  email?: string;
  password?: string;
}

export default function SignInForm({ serverError }: Props) {
  const [email, setEmail] = createSignal("");
  const [password, setPassword] = createSignal("");
  const [showPassword, setShowPassword] = createSignal(false);
  const [pending, setPending] = createSignal(false);
  const [errors, setErrors] = createSignal<SignInErrors>({});

  function validate() {
    const next: SignInErrors = {};

    if (!email().trim()) {
      next.email = "Email is required";
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email())) {
      next.email = "Enter a valid email address";
    }

    if (!password()) {
      next.password = "Password is required";
    }

    setErrors(next);
    return Object.keys(next).length === 0;
  }

  function clearError(field: keyof SignInErrors) {
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

  return (
    <form method="post" action="/api/auth/signin" class="space-y-4" onSubmit={handleSubmit} noValidate>
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
        placeholder="Your password"
        error={errors().password}
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

      <ServerError message={serverError} />

      <SubmitButton pending={pending()} pendingText="Signing in..." icon={<LogIn class="size-4" />}>
        Sign in
      </SubmitButton>
    </form>
  );
}
