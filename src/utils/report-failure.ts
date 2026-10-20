import { message } from "kui-vue";

/**
 * The request layer only announces timeouts and network failures; a refused
 * response arrives at the caller as a thrown error carrying the server's own
 * sentence. That sentence is usually the only explanation the operator gets —
 * which table blocked a delete, which field the backend rejected — so callers
 * report it instead of swallowing it.
 *
 * A 401 is the exception: the request layer ends the session and redirects to the
 * login page, and a second message under that notice only repeats the same event.
 * `httpStatus` is read off the error rather than checked with `instanceof`, because
 * pages are commonly tested with a stubbed request module that cannot export the class.
 */
export function reportFailure(reason: unknown, fallback: string) {
  if ((reason as { httpStatus?: number } | null)?.httpStatus === 401) return;
  message.error(reason instanceof Error && reason.message ? reason.message : fallback);
}
