/**
 * useAnchorNavigation — Bidirectional scroll between feedback cards and highlighted text.
 */
import { useRef, useCallback } from "react";

export function useAnchorNavigation() {
  const submissionRef = useRef<HTMLDivElement>(null);
  const feedbackRefs = useRef<Map<string, HTMLDivElement>>(new Map());

  /**
   * Scroll the submission text to show the highlighted anchor for a given feedback.
   * Also triggers a flash animation on the highlight.
   */
  const scrollToAnchor = useCallback((feedbackId: string) => {
    if (!submissionRef.current) return;

    const highlightEl = submissionRef.current.querySelector(
      `[data-feedback-ids*="${feedbackId}"]`
    ) as HTMLElement | null;

    if (highlightEl) {
      highlightEl.scrollIntoView({ behavior: "smooth", block: "center" });

      // Flash animation
      highlightEl.classList.add("highlight-flash");
      setTimeout(() => highlightEl.classList.remove("highlight-flash"), 2000);
    }
  }, []);

  /**
   * Scroll the feedback panel to show the card for a given feedback.
   * Also triggers a flash animation on the card.
   */
  const scrollToFeedback = useCallback((feedbackId: string) => {
    const cardEl = feedbackRefs.current.get(feedbackId);
    if (cardEl) {
      cardEl.scrollIntoView({ behavior: "smooth", block: "center" });

      // Flash animation
      cardEl.classList.add("feedback-card-flash");
      setTimeout(() => cardEl.classList.remove("feedback-card-flash"), 2000);
    }
  }, []);

  /**
   * Register a feedback card element ref.
   */
  const registerFeedbackRef = useCallback(
    (feedbackId: string, el: HTMLDivElement | null) => {
      if (el) {
        feedbackRefs.current.set(feedbackId, el);
      } else {
        feedbackRefs.current.delete(feedbackId);
      }
    },
    []
  );

  return {
    submissionRef,
    scrollToAnchor,
    scrollToFeedback,
    registerFeedbackRef,
  };
}
