'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { AnimatePresence, motion } from 'motion/react';
import { StepContext } from './steps/StepContext';
import { StepAreas } from './steps/StepAreas';
import { StepDetail } from './steps/StepDetail';
import { StepPreview } from './steps/StepPreview';
import { ProgressDots } from './components/ProgressDots';
import { completeOnboarding } from './actions';
import type { OnboardingAnswers, OnboardingContext, OnboardingArea, OnboardingDetail } from './types';

type WizardStep = 'context' | 'areas' | 'detail' | 'preview';

const slideVariants = {
  enter: (dir: number) => ({ opacity: 0, x: dir > 0 ? 20 : -20 }),
  center: { opacity: 1, x: 0 },
  exit: (dir: number) => ({ opacity: 0, x: dir > 0 ? -20 : 20 }),
};

function stepDotIndex(step: WizardStep): number {
  return { context: 1, areas: 2, detail: 3, preview: 0 }[step];
}

type Props = {
  lang?: string;
};

export function OnboardingFlow({ lang: _lang }: Props) {
  const router = useRouter();
  const [, startSkipTransition] = useTransition();

  // Navigation history stack — enables back without a fixed linear order
  const [history, setHistory] = useState<WizardStep[]>(['context']);
  const [direction, setDirection] = useState<1 | -1>(1);

  const currentStep = history[history.length - 1];

  // Partial answers — filled step by step
  const [answers, setAnswers] = useState<Partial<OnboardingAnswers>>({});

  function push(step: WizardStep) {
    setDirection(1);
    setHistory((h) => [...h, step]);
  }

  function pop() {
    if (history.length <= 1) return;
    setDirection(-1);
    setHistory((h) => h.slice(0, -1));
  }

  function handleSkip() {
    startSkipTransition(async () => {
      await completeOnboarding();
      router.refresh();
    });
  }

  function handleContextSelect(context: OnboardingContext) {
    setAnswers({ context });
    push('areas');
  }

  function handleAreasConfirm(areas: OnboardingArea[]) {
    setAnswers((prev) => ({ ...prev, areas }));
    const needsDetail = areas.includes('uni') || areas.includes('freelance');
    push(needsDetail ? 'detail' : 'preview');
  }

  function handleDetailConfirm(detail: OnboardingDetail) {
    setAnswers((prev) => ({ ...prev, detail }));
    push('preview');
  }

  function handleDone() {
    router.refresh();
  }

  // Determine dot count: always 3 during question steps (context/areas/detail).
  // If detail is skipped (not in history, user went areas→preview), show 2 dots.
  const detailInHistory = history.includes('detail');
  const totalDots = currentStep === 'preview' ? 0 : detailInHistory || currentStep === 'detail' ? 3 : 2;
  const currentDot = stepDotIndex(currentStep);

  const safeAnswers = answers as OnboardingAnswers;

  return (
    <div className="min-h-screen flex items-center justify-center p-6">
      <div className={currentStep === 'preview' ? 'w-full max-w-md' : 'w-full max-w-sm'}>
        {/* Header */}
        <div className="mb-8 text-center">
          <p className="text-xs text-muted-foreground uppercase tracking-wider font-mono">
            momentum
          </p>
          <h1 className="text-2xl font-semibold mt-0.5">command center</h1>
        </div>

        {/* Progress dots — hidden on preview step */}
        {currentStep !== 'preview' && totalDots > 0 && (
          <div className="mb-6">
            <ProgressDots current={currentDot} total={totalDots} />
          </div>
        )}

        {/* Steps */}
        <AnimatePresence mode="wait" custom={direction}>
          <motion.div
            key={currentStep}
            custom={direction}
            variants={slideVariants}
            initial="enter"
            animate="center"
            exit="exit"
            transition={{ duration: 0.2, ease: 'easeOut' }}
          >
            {currentStep === 'context' && (
              <StepContext
                onSelect={handleContextSelect}
                onSkip={handleSkip}
              />
            )}

            {currentStep === 'areas' && answers.context && (
              <StepAreas
                context={answers.context}
                onConfirm={handleAreasConfirm}
                onBack={pop}
                onSkip={handleSkip}
              />
            )}

            {currentStep === 'detail' && answers.areas && (
              <StepDetail
                areas={answers.areas}
                onConfirm={handleDetailConfirm}
                onBack={pop}
                onSkip={handleSkip}
              />
            )}

            {currentStep === 'preview' && answers.context && answers.areas && (
              <StepPreview
                answers={{
                  ...safeAnswers,
                  detail: safeAnswers.detail ?? {},
                }}
                onBack={pop}
                onDone={handleDone}
              />
            )}
          </motion.div>
        </AnimatePresence>
      </div>
    </div>
  );
}
