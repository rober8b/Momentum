type Props = {
  current: number; // 1-based
  total: number;
};

export function ProgressDots({ current, total }: Props) {
  return (
    <div className="flex items-center gap-2 justify-center">
      {Array.from({ length: total }, (_, i) => {
        const pos = i + 1;
        const isPast = pos < current;
        const isCurrent = pos === current;
        return (
          <div
            key={i}
            className={[
              'rounded-full transition-all duration-300',
              isCurrent ? 'w-5 h-1.5 bg-accent' : '',
              isPast ? 'w-1.5 h-1.5 bg-accent/40' : '',
              !isCurrent && !isPast ? 'w-1.5 h-1.5 bg-border' : '',
            ].join(' ')}
          />
        );
      })}
    </div>
  );
}
