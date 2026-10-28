import React, { useState } from 'react';

export default function QuizPanel({ questions = [] }) {
  const [answers, setAnswers] = useState({});
  const [revealed, setRevealed] = useState({});

  const choose = (q, optionIndex) => {
    setAnswers((old) => ({ ...old, [q.id]: optionIndex }));
    setRevealed((old) => ({ ...old, [q.id]: true }));
  };

  const score = questions.filter((q) => answers[q.id] === q.answer).length;

  return (
    <section className="panel quiz-panel">
      <div className="panel-title">
        <h2>教材自测</h2>
        <span>{score} / {questions.length}</span>
      </div>
      <div className="quiz-list">
        {questions.map((q, qi) => (
          <div className="quiz-item" key={q.id}>
            <p className="quiz-prompt">{qi + 1}. {q.prompt}</p>
            <div className="quiz-options">
              {q.options.map((opt, oi) => {
                const chosen = answers[q.id] === oi;
                const isAnswer = revealed[q.id] && oi === q.answer;
                return (
                  <button
                    key={opt}
                    className={[
                      'quiz-option',
                      chosen ? 'chosen' : '',
                      isAnswer ? 'correct' : ''
                    ].filter(Boolean).join(' ')}
                    onClick={() => choose(q, oi)}
                  >
                    {opt}
                  </button>
                );
              })}
            </div>
            {revealed[q.id] && <p className="quiz-explanation">{q.explanation}</p>}
          </div>
        ))}
      </div>
    </section>
  );
}
