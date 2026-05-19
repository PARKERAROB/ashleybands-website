"use client";

import { LETTERS } from "@/lib/staffSprint/notes";

export default function AnswerButtons({ onAnswer, disabled, lastResult }) {
  return (
    <div className="staff-sprint-answers" role="group" aria-label="note answer choices">
      {LETTERS.map((letter) => {
        const isWrongPick = lastResult && lastResult.picked === letter && !lastResult.correct;
        const isCorrectAnswer = lastResult && lastResult.actual === letter && !lastResult.correct;
        let cls = "ss-btn";
        if (isWrongPick) cls += " ss-btn--wrong";
        if (isCorrectAnswer) cls += " ss-btn--reveal";
        return (
          <button
            key={letter}
            className={cls}
            disabled={disabled}
            onClick={() => onAnswer(letter)}
            type="button"
          >
            {letter}
          </button>
        );
      })}
    </div>
  );
}
