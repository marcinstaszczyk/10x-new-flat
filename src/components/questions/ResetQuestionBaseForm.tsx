import { RotateCcw } from "lucide-solid";
import type { JSX } from "solid-js";

const confirmationValue = "reset-question-base";
const confirmationMessage =
  "Reset your question base? Every current question will be deleted and replaced with the active template list.";

export default function ResetQuestionBaseForm() {
  let confirmationInput: HTMLInputElement | undefined;

  const handleSubmit: JSX.EventHandler<HTMLFormElement, SubmitEvent> = (event) => {
    if (!window.confirm(confirmationMessage)) {
      event.preventDefault();
      return;
    }

    if (confirmationInput) {
      confirmationInput.value = confirmationValue;
    }
  };

  return (
    <form method="post" action="/api/questions/reset" onSubmit={handleSubmit}>
      <input ref={confirmationInput} type="hidden" name="confirmation" value="" />
      <button
        type="submit"
        class="inline-flex items-center justify-center gap-2 rounded-md border border-red-200 bg-white px-4 py-2 text-sm font-medium text-red-700 transition-colors hover:bg-red-50 focus-visible:ring-2 focus-visible:ring-red-500 focus-visible:ring-offset-2 focus-visible:outline-none"
      >
        <RotateCcw class="size-4" aria-hidden="true" />
        Reset questions
      </button>
    </form>
  );
}
