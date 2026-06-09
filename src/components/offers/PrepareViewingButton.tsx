import { LoaderCircle, Sparkles } from "lucide-solid";
import { createSignal } from "solid-js";

interface Props {
  offerId: string;
  hasResult: boolean;
}

type PrepareStatus =
  | "already_exists"
  | "configuration"
  | "input_too_large"
  | "invalid_output"
  | "provider"
  | "question_base"
  | "storage"
  | "timeout"
  | "unexpected";

const errorLabels: Record<PrepareStatus, string> = {
  already_exists: "Preparation already exists. Reloading...",
  configuration: "Preparation is not configured yet.",
  input_too_large: "This offer is too large to prepare.",
  invalid_output: "The provider returned an invalid result. Try again.",
  provider: "The provider could not prepare this offer. Try again.",
  question_base: "We couldn't load your question base. Try again.",
  storage: "We couldn't save the preparation result. Try again.",
  timeout: "Preparation timed out. Try again.",
  unexpected: "We couldn't prepare this offer. Try again.",
};

export default function PrepareViewingButton(props: Props) {
  const [isPending, setIsPending] = createSignal(false);
  const [message, setMessage] = createSignal(props.hasResult ? errorLabels.already_exists : "");
  const [isError, setIsError] = createSignal(false);

  const prepareOffer = async () => {
    if (props.hasResult || isPending()) {
      return;
    }

    setIsPending(true);
    setIsError(false);
    setMessage("Preparing viewing notes. This can take up to a minute.");

    try {
      const response = await fetch(`/api/offers/${props.offerId}/prepare`, { method: "POST" });
      const payload = (await response.json().catch(() => ({}))) as { status?: string };

      if (response.status === 201) {
        window.location.reload();
        return;
      }

      if (response.status === 409) {
        setMessage(errorLabels.already_exists);
        window.location.reload();
        return;
      }

      setIsError(true);
      setMessage(errorLabelForStatus(payload.status));
    } catch {
      setIsError(true);
      setMessage(errorLabels.unexpected);
    } finally {
      setIsPending(false);
    }
  };

  return (
    <div class="flex flex-col items-start gap-2">
      <button
        type="button"
        class="inline-flex items-center justify-center gap-2 rounded-md bg-slate-950 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-slate-800 focus-visible:ring-2 focus-visible:ring-slate-500 focus-visible:ring-offset-2 focus-visible:outline-none disabled:pointer-events-none disabled:opacity-60"
        disabled={props.hasResult || isPending()}
        onClick={prepareOffer}
      >
        {isPending() ? (
          <LoaderCircle class="size-4 animate-spin" aria-hidden="true" />
        ) : (
          <Sparkles class="size-4" aria-hidden="true" />
        )}
        {props.hasResult ? "Preparation ready" : isPending() ? "Preparing..." : "Prepare viewing"}
      </button>
      {message() && (
        <p class={isError() ? "max-w-sm text-sm text-red-700" : "max-w-sm text-sm text-slate-500"} aria-live="polite">
          {message()}
        </p>
      )}
    </div>
  );
}

function errorLabelForStatus(status: string | undefined) {
  if (status && status in errorLabels) {
    return errorLabels[status as PrepareStatus];
  }

  return errorLabels.unexpected;
}
