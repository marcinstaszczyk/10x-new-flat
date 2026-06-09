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
  already_exists: "Odpowiedzi są już gotowe. Przewiń niżej, aby je zobaczyć.",
  configuration: "Generowanie odpowiedzi nie jest jeszcze skonfigurowane.",
  input_too_large: "Ta oferta jest zbyt duża, aby przygotować odpowiedzi.",
  invalid_output: "Dostawca zwrócił nieprawidłowy wynik. Spróbuj ponownie.",
  provider: "Nie udało się przygotować odpowiedzi. Spróbuj ponownie.",
  question_base: "Nie udało się wczytać Twoich pytań. Spróbuj ponownie.",
  storage: "Nie udało się zapisać wyników. Spróbuj ponownie.",
  timeout: "Przygotowanie odpowiedzi trwało zbyt długo. Spróbuj ponownie.",
  unexpected: "Nie udało się przygotować odpowiedzi. Spróbuj ponownie.",
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
    setMessage("Przygotowuję odpowiedzi. To może potrwać do minuty.");

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
        {props.hasResult ? "Odpowiedzi gotowe" : isPending() ? "Przygotowuję..." : "Przygotuj odpowiedzi"}
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
